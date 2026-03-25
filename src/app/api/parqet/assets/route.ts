import { NextResponse } from "next/server";
import {
    getCookieValue,
    refreshParqetAccessToken,
} from "../../../../lib/parqet";
import { fetchAuthorizedPortfolios } from "../../../../lib/parqet-assets/fetch-portfolios";
import { loadActivitiesForPortfolios } from "../../../../lib/parqet-assets/fetch-activities";
import { isRealSecurityActivity } from "../../../../lib/parqet-assets/filters";
import { groupActivitiesByIsin } from "../../../../lib/parqet-assets/grouping";
import { loadAssetMetadataByIsin } from "../../../../lib/parqet-assets/metadata";
import { buildConsistencyReport } from "../../../../lib/parqet-assets/consistency";


// Diese Route orchestriert nur:
// - Token pruefen
// - Portfolios / Activities laden
// - filtern
// - aggregieren
// - Metadaten anreichern
// - aktive / geschlossene Assets trennen
// - Konsistenzreport berechnen
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

            const groupedAssets = groupActivitiesByIsin(
                filteredActivities,
                portfolioNameById
            );

            const metadataByIsin = await loadAssetMetadataByIsin(
                groupedAssets.map((asset: import("../../../../lib/types").AssetSummary) => asset.isin)
            );

            const enrichedAssets = groupedAssets.map(
                (asset: import("../../../../lib/types").AssetSummary) => {
                const metadata = metadataByIsin[asset.isin];

                return {
                    ...asset,
                    name: asset.name ?? metadata?.name ?? null,
                    symbol: asset.symbol ?? metadata?.symbol ?? null,
                    wkn: asset.wkn ?? metadata?.wkn ?? null,
                };
            });

            const activeAssets = enrichedAssets.filter(
                (asset: import("../../../../lib/types").AssetSummary) => asset.netShares > 0
            );

            const closedAssets = enrichedAssets.filter(
                (asset: import("../../../../lib/types").AssetSummary) => asset.netShares <= 0
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
                generatedAt: new Date().toISOString(),
            };
        }

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