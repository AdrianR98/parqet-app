import { NextResponse } from "next/server";
import {
    clearParqetTokenCookies,
    getCookieValue,
    refreshParqetAccessToken,
    setParqetTokenCookies,
    type TokenRefreshResult,
} from "../../../../lib/parqet";
import {
    buildPortfolioHealthBudgetInfo,
    classifyParqetApiError,
    getErrorMessage,
    messageForDiagnostic,
    redactProviderErrorMessage,
    type ParqetApiDiagnostic,
} from "../../../../lib/parqet-api-diagnostics";

const HEALTH_API_BUDGET = buildPortfolioHealthBudgetInfo();

function buildReconnectResponse(message: string) {
    const response = NextResponse.json(
        {
            ok: false,
            authRequired: true,
            reconnectUrl: "/api/auth/start",
            message,
            apiBudget: HEALTH_API_BUDGET,
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
            apiBudget: HEALTH_API_BUDGET,
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
            apiBudget: HEALTH_API_BUDGET,
        },
        { status: getStatusForDiagnostic(input.diagnostic) }
    );
}

async function fetchPortfolios(currentAccessToken: string) {
    return fetch("https://connect.parqet.com/portfolios", {
        headers: {
            Authorization: `Bearer ${currentAccessToken}`,
        },
    });
}

async function buildHealthResult(currentAccessToken: string) {
    const portfoliosRes = await fetchPortfolios(currentAccessToken);
    const rawText = await portfoliosRes.text();

    if (!portfoliosRes.ok) {
        throw new Error(`Portfolios health check failed (${portfoliosRes.status}): ${rawText}`);
    }

    const portfolios = JSON.parse(rawText) as { items?: unknown[] };

    return {
        ok: true,
        authRequired: false,
        portfolioAccessOk: true,
        portfolioCount: Array.isArray(portfolios.items) ? portfolios.items.length : 0,
        activityFetchPerformed: false,
        generatedAt: new Date().toISOString(),
        apiBudget: HEALTH_API_BUDGET,
    };
}

// Lightweight health route for auth/session checks.
// It may call the Parqet portfolios endpoint, but never fetches Activities.
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

            const response = NextResponse.json({
                ...(await buildHealthResult(accessToken)),
                refreshed: true,
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
            return NextResponse.json({
                ...(await buildHealthResult(accessToken)),
                refreshed: false,
            });
        } catch (error) {
            const diagnostic = classifyParqetApiError(error);

            if (diagnostic.category !== "auth_error") {
                return buildFailureResponse({ diagnostic, error, refreshed: false });
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

            try {
                const response = NextResponse.json({
                    ...(await buildHealthResult(accessToken)),
                    refreshed: true,
                });

                setParqetTokenCookies(response, {
                    accessToken,
                    refreshToken: refreshed.newRefreshToken,
                    accessTokenExpiresInSeconds: refreshed.accessTokenExpiresInSeconds ?? null,
                    refreshTokenExpiresInSeconds: refreshed.refreshTokenExpiresInSeconds ?? null,
                });

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
                message: "Parqet health route failed.",
                details: redactProviderErrorMessage(getErrorMessage(error)),
                apiBudget: HEALTH_API_BUDGET,
            },
            { status: 500 }
        );
    }
}
