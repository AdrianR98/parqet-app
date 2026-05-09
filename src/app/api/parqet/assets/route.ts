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
import {
    buildActivityScanBudgetInfo,
    classifyParqetApiError,
    getErrorMessage,
    messageForDiagnostic,
    redactProviderErrorMessage,
    type ParqetApiDiagnostic,
} from "../../../../lib/parqet-api-diagnostics";
import { buildActivityContext } from "../../../../lib/parqet-assets/build-activity-context";
import { loadAssetMetadataByIsin } from "../../../../lib/parqet-assets/metadata";
import { buildConsistencyReport } from "../../../../lib/parqet-assets/consistency";
import { buildCorrectedAssets } from "../../../../lib/parqet-assets/build-corrected-assets";
import { resolveAssetDisplay } from "../../../../lib/metadata-utils";

const CLOSED_POSITION_EPSILON = 1e-8;
const ASSETS_API_BUDGET = buildActivityScanBudgetInfo({
    activityFetchScope: "selected_portfolios",
    responseFlagsReduceProviderCalls: false,
});

function buildReconnectResponse(message: string) {
    const response = NextResponse.json(
        {
            ok: false,
            activeAssets: [],
            closedAssets: [],
            rawActivityCount: 0,
            filteredActivityCount: 0,
            assetCount: 0,
            activeAssetCount: 0,
            closedAssetCount: 0,
            consistencyReport: null,
            reconciliationWarnings: [],
            generatedAt: new Date().toISOString(),
            authRequired: true,
            reconnectUrl: "/api/auth/start",
            message,
            apiBudget: ASSETS_API_BUDGET,
        },
        { status: 401 }
    );

    response.cookies.set("parqet_access_token", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    response.cookies.set("parqet_refresh_token", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    return response;
}

function getStatusForDiagnostic(diagnostic: ParqetApiDiagnostic): number {
    switch (diagnostic.category) {
        case "rate_limit":
            return 429;
        case "auth_error":
        case "auth_refresh_failed":
        case "missing_access_token":
            return 401;
        case "provider_error":
        case "pipeline_error":
            return 500;
    }
}

function buildFailureResponse(input: {
    diagnostic: ParqetApiDiagnostic;
    error: unknown;
    refreshed: boolean;
}) {
    return NextResponse.json(
        {
            ok: false,
            message: messageForDiagnostic(input.diagnostic),
            refreshed: input.refreshed,
            diagnostic: input.diagnostic,
            error: redactProviderErrorMessage(getErrorMessage(input.error)),
            apiBudget: ASSETS_API_BUDGET,
        },
        { status: getStatusForDiagnostic(input.diagnostic) }
    );
}

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
                    apiBudget: ASSETS_API_BUDGET,
                },
                { status: 400 }
            );
        }

        const cookieHeader = req.headers.get("cookie") || "";

        let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
        const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

        if (!accessToken) {
            return buildReconnectResponse("Parqet-Verbindung nicht vorhanden oder abgelaufen.");
        }

        // ========================================================
        // Zentrale Build-Pipeline
        // ========================================================

        async function buildAssetView(currentAccessToken: string) {
            const activityContext = await buildActivityContext(
                currentAccessToken,
                portfolioIds
            );

            const correctedAssets = buildCorrectedAssets(
                activityContext.correctedActivities,
                activityContext.portfolioNameById
            );

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
                    const resolvedDisplay = resolveAssetDisplay({
                        isin: asset.isin,
                        metadata,
                        activity: asset,
                    });

                    return {
                        ...asset,
                        name: resolvedDisplay.name,

                        assetName: asset.assetName ?? metadata?.name ?? null,
                        displayName: asset.displayName ?? metadata?.name ?? null,
                        title: asset.title ?? metadata?.name ?? null,

                        symbol: resolvedDisplay.symbol,
                        ticker: resolvedDisplay.ticker,
                        tickerSymbol: resolvedDisplay.tickerSymbol,
                        wkn: resolvedDisplay.wkn,

                        externalMetadata: {
                            ...(asset.externalMetadata ?? {}),
                            ...(metadata ?? {}),
                            metadataSource: resolvedDisplay.source,
                            subtitle: resolvedDisplay.subtitle,
                        },
                    };
                }
            );

            const activeAssets = enrichedAssets.filter(
                (asset: AssetSummary) => asset.netShares > CLOSED_POSITION_EPSILON
            );

            const closedAssets = enrichedAssets.filter(
                (asset: AssetSummary) => asset.netShares <= CLOSED_POSITION_EPSILON
            );

            const consistencyReport = buildConsistencyReport(enrichedAssets);

            return {
                rawActivityCount: activityContext.rawActivities.length,
                filteredActivityCount: activityContext.filteredActivities.length,
                assetCount: enrichedAssets.length,
                activeAssetCount: activeAssets.length,
                closedAssetCount: closedAssets.length,
                activeAssets,
                closedAssets,
                consistencyReport,
                reconciliationWarnings: activityContext.reconciliationWarnings,
                generatedAt: new Date().toISOString(),
                apiBudget: ASSETS_API_BUDGET,
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
            const diagnostic = classifyParqetApiError(error);

            if (diagnostic.category !== "auth_error") {
                return buildFailureResponse({ diagnostic, error, refreshed: false });
            }

            if (!refreshToken) {
                return buildFailureResponse({ diagnostic, error, refreshed: false });
            }

            // ====================================================
            // Fallback: Token nur bei wahrscheinlichem Auth-Fehler erneuern
            // ====================================================

            const refreshed = await refreshParqetAccessToken(refreshToken);

            if (!refreshed.accessToken) {
                return buildReconnectResponse("Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden.");
            }

            accessToken = refreshed.accessToken;

            try {
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
            } catch (retryError) {
                return buildFailureResponse({
                    diagnostic: classifyParqetApiError(retryError),
                    error: retryError,
                    refreshed: true,
                });
            }
        }
    } catch (error: unknown) {
        return NextResponse.json(
            {
                ok: false,
                message: "Assets route failed.",
                details: redactProviderErrorMessage(getErrorMessage(error)),
                apiBudget: ASSETS_API_BUDGET,
            },
            { status: 500 }
        );
    }
}
