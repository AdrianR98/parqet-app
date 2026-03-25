// ============================================================
// src/app/api/parqet/assets/route.ts
// ------------------------------------------------------------
// Diese Route orchestriert:
//
// - Token pruefen
// - Portfolios / Activities laden
// - filtern
// - normalisieren
// - Overrides anwenden
// - Reconciliation-Warnungen bauen
// - bereinigte Assets erzeugen
// - lokale CSV-Metadaten anreichern
// - aktive / geschlossene Assets trennen
// - Konsistenzreport berechnen
// ============================================================

import { NextResponse } from "next/server";
import type { AssetSummary } from "../../../../lib/types";
import {
    getCookieValue,
    refreshParqetAccessToken,
} from "../../../../lib/parqet";
import { fetchAuthorizedPortfolios } from "../../../../lib/parqet-assets/fetch-portfolios";
import { loadActivitiesForPortfolios } from "../../../../lib/parqet-assets/fetch-activities";
import { isRealSecurityActivity } from "../../../../lib/parqet-assets/filters";
import { loadAssetMetadataByIsin } from "../../../../lib/parqet-assets/metadata";
import { buildConsistencyReport } from "../../../../lib/parqet-assets/consistency";
import { normalizeActivities } from "../../../../lib/parqet-assets/normalization";
import { applyOverrides } from "../../../../lib/parqet-assets/overrides";
import { buildReconciliationWarnings } from "../../../../lib/parqet-assets/reconciliation";
import { buildCorrectedAssets } from "../../../../lib/parqet-assets/build-corrected-assets";

// ============================================================
// GET /api/parqet/assets
// ============================================================

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const portfolioIds = url.searchParams.getAll("portfolioId");

        if (portfolioIds.length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No portfolioId parameters provided.",
                },
                { status: 400 }
            );
        }

        const cookieHeader = req.headers.get("cookie") || "";

        let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
        const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

        if (!accessToken) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No access token found.",
                },
                { status: 401 }
            );
        }

        // ========================================================
        // Zentrale Build-Pipeline
        // ========================================================

        async function buildAssetView(currentAccessToken: string) {
            const portfolios = await fetchAuthorizedPortfolios(currentAccessToken);
            const portfolioNameById = new Map<string, string>();

            for (const portfolio of portfolios) {
                portfolioNameById.set(portfolio.id, portfolio.name);
            }

            const allActivities = await loadActivitiesForPortfolios(
                currentAccessToken,
                portfolioIds
            );

            const filteredActivities = allActivities.filter(isRealSecurityActivity);

            // ====================================================
            // Bereinigte Datenpipeline
            // ----------------------------------------------------
            // Reihenfolge ist bewusst:
            // 1) filtern
            // 2) normalisieren
            // 3) Overrides anwenden
            // 4) Reconciliation-Warnungen erzeugen
            // 5) bereinigte Assets daraus bauen
            // ====================================================

            const normalized = normalizeActivities(filteredActivities);
            const corrected = applyOverrides(normalized);
            const warnings = buildReconciliationWarnings(corrected);

            const correctedAssets = buildCorrectedAssets(corrected, portfolioNameById);

            // ====================================================
            // Lokale Metadaten laden
            // ----------------------------------------------------
            // Diese Quelle kommt jetzt aus:
            // - generierter CSV-Mapping-Datei
            // - optionalem lokalem Seed
            //
            // WICHTIG:
            // Beim Namen gilt bewusst:
            // CSV-Metadata -> Activity-Name -> Fallback
            // ====================================================

            const metadataByIsin = await loadAssetMetadataByIsin(
                correctedAssets.map((asset: AssetSummary) => asset.isin)
            );

            const enrichedAssets: AssetSummary[] = correctedAssets.map(
                (asset: AssetSummary) => {
                    const metadata = metadataByIsin[asset.isin];

                    return {
                        ...asset,

                        // ====================================================
                        // Name Prioritaet:
                        // 1) CSV / lokale Metadata
                        // 2) bereits erkannter Activity-Name
                        // 3) sonstige Fallbacks
                        // ====================================================

                        name:
                            metadata?.name ??
                            asset.name ??
                            asset.assetName ??
                            asset.displayName ??
                            asset.title ??
                            asset.symbol ??
                            asset.ticker ??
                            asset.tickerSymbol ??
                            asset.wkn ??
                            asset.isin,

                        assetName: asset.assetName ?? metadata?.name ?? null,
                        displayName: asset.displayName ?? metadata?.name ?? null,
                        title: asset.title ?? metadata?.name ?? null,

                        symbol: metadata?.symbol ?? asset.symbol ?? null,
                        ticker: asset.ticker ?? metadata?.ticker ?? null,
                        tickerSymbol: asset.tickerSymbol ?? metadata?.tickerSymbol ?? null,
                        wkn: metadata?.wkn ?? asset.wkn ?? null,

                        externalMetadata: {
                            ...(asset.externalMetadata ?? {}),
                            ...(metadata ?? {}),
                            metadataSource: metadata?.name ? "csv" : "activity",
                        },
                    };
                }
         
            );

            const activeAssets = enrichedAssets.filter(
                (asset: AssetSummary) => asset.netShares > 0
            );

            const closedAssets = enrichedAssets.filter(
                (asset: AssetSummary) => asset.netShares <= 0
            );

            const consistencyReport = buildConsistencyReport(enrichedAssets);

            return {
                rawActivityCount: allActivities.length,
                filteredActivityCount: filteredActivities.length,
                assetCount: enrichedAssets.length,
                activeAssetCount: activeAssets.length,
                closedAssetCount: closedAssets.length,
                activeAssets,
                closedAssets,
                consistencyReport,
                reconciliationWarnings: warnings,
                generatedAt: new Date().toISOString(),
            };
        }

        // ========================================================
        // Erster Versuch mit aktuellem Access Token
        // ========================================================

        try {
            const result = await buildAssetView(accessToken);

            return NextResponse.json({
                ok: true,
                refreshed: false,
                requestedPortfolioIds: portfolioIds,
                ...result,
            });
        } catch (error) {
            if (!refreshToken) {
                throw error;
            }

            // ====================================================
            // Fallback: Token erneuern und erneut versuchen
            // ====================================================

            const refreshed = await refreshParqetAccessToken(refreshToken);

            if (!refreshed.accessToken) {
                return NextResponse.json(
                    {
                        ok: false,
                        message: "Access token expired and refresh failed.",
                    },
                    { status: 401 }
                );
            }

            accessToken = refreshed.accessToken;

            const result = await buildAssetView(accessToken);

            const response = NextResponse.json({
                ok: true,
                refreshed: true,
                requestedPortfolioIds: portfolioIds,
                ...result,
            });

            response.cookies.set("parqet_access_token", accessToken, {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
            });

            if (refreshed.newRefreshToken) {
                response.cookies.set("parqet_refresh_token", refreshed.newRefreshToken, {
                    httpOnly: true,
                    sameSite: "lax",
                    path: "/",
                });
            }

            return response;
        }
    } catch (error: unknown) {
        return NextResponse.json(
            {
                ok: false,
                message: "Assets route failed.",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}