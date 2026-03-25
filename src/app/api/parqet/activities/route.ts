type Activity = {
    id: string;
    type: string;
    amount?: number;
    amountNet?: number;
    datetime: string;
    asset?: {
        isin?: string;
    };
};

import { NextResponse } from "next/server";
import {
    getCookieValue,
    refreshParqetAccessToken,
} from "../../../../lib/parqet";

// Diese Funktion lädt ALLE Activities eines Portfolios (inkl. Pagination)
async function fetchAllActivitiesForPortfolio(
    accessToken: string,
    portfolioId: string
) {
    const allActivities: Activity[] = [];
    let cursor: string | null = null;

    // Wir laden so lange, bis kein Cursor mehr zurückkommt
    while (true) {
        // URL zusammenbauen (mit oder ohne Cursor)
        const url = new URL(
            `https://connect.parqet.com/portfolios/${portfolioId}/activities`
        );

        if (cursor) {
            url.searchParams.set("cursor", cursor);
        }

        const res = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const rawText = await res.text();

        if (!res.ok) {
            throw new Error(
                `Parqet activities fetch failed (${res.status}): ${rawText}`
            );
        }

        const data: {
            activities?: Activity[];
            cursor?: string;
        } = JSON.parse(rawText);

        const activities = data.activities ?? [];

        // Activities sammeln
        allActivities.push(...activities);

        // Cursor für nächste Seite holen
        cursor = data.cursor ?? null;

        // Wenn kein Cursor mehr → fertig
        if (!cursor) {
            break;
        }
    }

    return allActivities;
}

// Route
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);

        // Portfolio IDs aus Query lesen
        const portfolioIds = url.searchParams.getAll("portfolioId");

        if (portfolioIds.length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No portfolioIds provided",
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
                    message: "No access token",
                },
                { status: 401 }
            );
        }

        // Helper: lädt alle Portfolios
        async function loadAll(currentToken: string) {
            const results = [];

            for (const portfolioId of portfolioIds) {
                const activities = await fetchAllActivitiesForPortfolio(
                    currentToken,
                    portfolioId
                );

                results.push({
                    portfolioId,
                    activities,
                });
            }

            return results;
        }

        let portfolioResults;

        try {
            portfolioResults = await loadAll(accessToken);
        } catch (err: unknown) {
            // Falls Token abgelaufen → refresh versuchen
            if (refreshToken) {
                const refreshed = await refreshParqetAccessToken(refreshToken);

                if (!refreshed.accessToken) {
                    throw new Error("Refresh failed");
                }

                accessToken = refreshed.accessToken;

                portfolioResults = await loadAll(accessToken);

                const response = NextResponse.json({
                    ok: true,
                    refreshed: true,
                    portfolioResults,
                    activities: portfolioResults.flatMap((p) => p.activities),
                });

                response.cookies.set("parqet_access_token", accessToken, {
                    httpOnly: true,
                    sameSite: "lax",
                    path: "/",
                });

                if (refreshed.newRefreshToken) {
                    response.cookies.set(
                        "parqet_refresh_token",
                        refreshed.newRefreshToken,
                        {
                            httpOnly: true,
                            sameSite: "lax",
                            path: "/",
                        }
                    );
                }

                return response;
            }

            throw err;
        }

        return NextResponse.json({
            ok: true,
            refreshed: false,
            portfolioResults,
            activities: portfolioResults.flatMap((p) => p.activities),
        });
    } catch (error: unknown) {
        return NextResponse.json(
            {
                ok: false,
                message: "Activities load failed",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}