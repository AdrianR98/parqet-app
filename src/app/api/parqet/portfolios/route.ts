import { NextResponse } from "next/server";
import {
    clearParqetTokenCookies,
    getCookieValue,
    refreshParqetAccessToken,
    setParqetTokenCookies,
    type TokenRefreshResult,
} from "../../../../lib/parqet";

function messageForPortfolioStatus(status: number) {
    if (status === 429) {
        return "Parqet begrenzt gerade weitere Anfragen. Bitte warte und versuche es später manuell erneut.";
    }

    if (status >= 500) {
        return "Parqet konnte die Portfolios gerade nicht liefern. Bitte versuche es später manuell erneut.";
    }

    return "Portfolios konnten nicht geladen werden. Bitte versuche es später manuell erneut.";
}

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

async function fetchPortfolios(currentAccessToken: string) {
    return fetch("https://connect.parqet.com/portfolios", {
        headers: {
            Authorization: `Bearer ${currentAccessToken}`,
        },
    });
}

// Diese Route laedt die autorisierten Portfolios von Parqet.
// Wenn der Access Token abgelaufen ist, wird automatisch ein Refresh versucht.
export async function GET(req: Request) {
    try {
        const cookieHeader = req.headers.get("cookie") || "";

        let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
        const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

        if (!accessToken && !refreshToken) {
            return buildReconnectResponse("Parqet-Verbindung nicht vorhanden oder abgelaufen.");
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
            const portfoliosRes = await fetchPortfolios(accessToken);
            const rawText = await portfoliosRes.text();

            if (!portfoliosRes.ok) {
                if (portfoliosRes.status === 401) {
                    return buildReconnectResponse("Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden.");
                }

                return NextResponse.json(
                    {
                        ok: false,
                        message: messageForPortfolioStatus(portfoliosRes.status),
                        status: portfoliosRes.status,
                    },
                    { status: 500 }
                );
            }

            const portfolios = JSON.parse(rawText);
            const response = NextResponse.json({
                ok: true,
                refreshed: true,
                portfolios,
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

        let portfoliosRes = await fetchPortfolios(accessToken);

        if (portfoliosRes.status === 401) {
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
            portfoliosRes = await fetchPortfolios(accessToken);

            const rawText = await portfoliosRes.text();

            if (!portfoliosRes.ok) {
                if (portfoliosRes.status === 401) {
                    return buildReconnectResponse("Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden.");
                }

                return NextResponse.json(
                    {
                        ok: false,
                        message: messageForPortfolioStatus(portfoliosRes.status),
                        status: portfoliosRes.status,
                    },
                    { status: 500 }
                );
            }

            const portfolios = JSON.parse(rawText);
            const response = NextResponse.json({
                ok: true,
                refreshed: true,
                portfolios,
            });

            setParqetTokenCookies(response, {
                accessToken,
                refreshToken: refreshed.newRefreshToken,
                accessTokenExpiresInSeconds: refreshed.accessTokenExpiresInSeconds ?? null,
                refreshTokenExpiresInSeconds: refreshed.refreshTokenExpiresInSeconds ?? null,
            });

            return response;
        }

        const rawText = await portfoliosRes.text();

        if (!portfoliosRes.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    message: messageForPortfolioStatus(portfoliosRes.status),
                    status: portfoliosRes.status,
                },
                { status: 500 }
            );
        }

        const portfolios = JSON.parse(rawText);

        return NextResponse.json({
            ok: true,
            refreshed: false,
            portfolios,
        });
    } catch {
        return NextResponse.json(
            {
                ok: false,
                message: "Portfolios konnten nicht geladen werden. Bitte versuche es später manuell erneut.",
            },
            { status: 500 }
        );
    }
}
