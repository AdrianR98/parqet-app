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
    clearParqetTokenCookies,
    getCookieValue,
    refreshParqetAccessToken,
    setParqetTokenCookies,
    type TokenRefreshResult,
} from "../../../../lib/parqet";

const MAX_PORTFOLIO_IDS = 50;
const MAX_ACTIVITY_PAGES_PER_PORTFOLIO = 250;

function buildReconnectResponse(message: string) {
    const response = NextResponse.json(
        {
            ok: false,
            authRequired: true,
            reconnectUrl: "/api/auth/start",
            message,
        },
        { status: 401 }
    );

    clearParqetTokenCookies(response, { clearRefreshToken: true });
    return response;
}

function buildTemporaryRefreshFailureResponse() {
    return NextResponse.json(
        {
            ok: false,
            authRequired: false,
            message:
                "Parqet ist vorübergehend nicht erreichbar. Bitte versuche die Aktualisierung später erneut.",
        },
        { status: 503 }
    );
}

function isInvalidRefresh(result: TokenRefreshResult): boolean {
    return !result.ok && result.reason === "invalid_refresh";
}

function isTemporaryRefreshFailure(result: TokenRefreshResult): boolean {
    return (
        !result.ok &&
        (result.reason === "provider_error" ||
            result.reason === "network_error" ||
            result.reason === "unknown" ||
            result.reason === "missing_client_id")
    );
}

function isAuthError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    return (
        message.includes("(401)") ||
        message.includes(" 401 ") ||
        message.includes("401:") ||
        lowerMessage.includes("unauthorized")
    );
}

// Diese Funktion lädt ALLE Activities eines Portfolios (inkl. Pagination)
async function fetchAllActivitiesForPortfolio(
    accessToken: string,
    portfolioId: string
) {
    const allActivities: Activity[] = [];
    let cursor: string | null = null;
    let pageCounter = 0;

    // Wir laden so lange, bis kein Cursor mehr zurückkommt
    while (true) {
        pageCounter += 1;

        if (pageCounter > MAX_ACTIVITY_PAGES_PER_PORTFOLIO) {
            throw new Error("Too many activity pages");
        }

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

        if (!res.ok) {
            throw new Error(`Parqet activities fetch failed (${res.status})`);
        }

        const rawText = await res.text();
        const data: {
            activities?: Activity[];
            cursor?: string;
        } = JSON.parse(rawText);

        const activities = data.activities ?? [];
        allActivities.push(...activities);
        cursor = data.cursor ?? null;

        if (!cursor) {
            break;
        }
    }

    return allActivities;
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const portfolioIds = Array.from(
            new Set(
                url.searchParams
                    .getAll("portfolioId")
                    .map((value) => value.trim())
                    .filter((value) => value.length > 0),
            ),
        );

        if (portfolioIds.length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Keine portfolioId-Parameter vorhanden.",
                },
                { status: 400 }
            );
        }

        if (portfolioIds.length > MAX_PORTFOLIO_IDS) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Zu viele Portfolio-IDs angefragt.",
                },
                { status: 400 },
            );
        }

        const cookieHeader = req.headers.get("cookie") || "";

        let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
        const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

        if (!accessToken && !refreshToken) {
            return buildReconnectResponse("Parqet-Verbindung nicht vorhanden oder abgelaufen.");
        }

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

        if (!accessToken && refreshToken) {
            const refreshed = await refreshParqetAccessToken(refreshToken);

            if (isInvalidRefresh(refreshed)) {
                return buildReconnectResponse("Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden.");
            }

            if (isTemporaryRefreshFailure(refreshed)) {
                return buildTemporaryRefreshFailureResponse();
            }

            if (!refreshed.ok) {
                return buildReconnectResponse("Parqet-Verbindung muss erneuert werden.");
            }

            accessToken = refreshed.accessToken;

            const portfolioResults = await loadAll(accessToken);

            const response = NextResponse.json({
                ok: true,
                refreshed: true,
                portfolioResults,
                activities: portfolioResults.flatMap((p) => p.activities),
            });

            setParqetTokenCookies(response, {
                accessToken,
                refreshToken: refreshed.newRefreshToken,
                accessTokenExpiresInSeconds: refreshed.accessTokenExpiresInSeconds ?? null,
                refreshTokenExpiresInSeconds: refreshed.refreshTokenExpiresInSeconds ?? null,
            });

            return response;
        }

        if (!accessToken) {
            return buildReconnectResponse("Parqet-Verbindung nicht vorhanden oder abgelaufen.");
        }

        try {
            const portfolioResults = await loadAll(accessToken);

            return NextResponse.json({
                ok: true,
                refreshed: false,
                portfolioResults,
                activities: portfolioResults.flatMap((p) => p.activities),
            });
        } catch (err: unknown) {
            if (!isAuthError(err)) {
                throw err;
            }

            if (!refreshToken) {
                return buildReconnectResponse("Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden.");
            }

            const refreshed = await refreshParqetAccessToken(refreshToken);

            if (isInvalidRefresh(refreshed)) {
                return buildReconnectResponse("Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden.");
            }

            if (isTemporaryRefreshFailure(refreshed)) {
                return buildTemporaryRefreshFailureResponse();
            }

            if (!refreshed.ok) {
                return buildReconnectResponse("Parqet-Verbindung muss erneuert werden.");
            }

            accessToken = refreshed.accessToken;
            const portfolioResults = await loadAll(accessToken);

            const response = NextResponse.json({
                ok: true,
                refreshed: true,
                portfolioResults,
                activities: portfolioResults.flatMap((p) => p.activities),
            });

            setParqetTokenCookies(response, {
                accessToken,
                refreshToken: refreshed.newRefreshToken,
                accessTokenExpiresInSeconds: refreshed.accessTokenExpiresInSeconds ?? null,
                refreshTokenExpiresInSeconds: refreshed.refreshTokenExpiresInSeconds ?? null,
            });

            return response;
        }
    } catch {
        return NextResponse.json(
            {
                ok: false,
                message:
                    "Aktivitäten konnten nicht geladen werden. Bitte versuche es später manuell erneut.",
            },
            { status: 500 }
        );
    }
}
