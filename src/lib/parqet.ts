// Diese Hilfsdatei enthaelt Funktionen fuer den Umgang mit Parqet-Tokens.
import type { NextResponse } from "next/server";

type TokenCookieKind = "access" | "refresh";

type CookieLifetimeInput = {
    accessTokenExpiresInSeconds?: number | null;
    refreshTokenExpiresInSeconds?: number | null;
};

type TokenRefreshFailureReason =
    | "invalid_refresh"
    | "provider_error"
    | "network_error"
    | "missing_client_id"
    | "unknown";

type TokenRefreshSuccess = {
    ok: true;
    accessToken: string;
    newRefreshToken?: string;
    accessTokenExpiresInSeconds?: number | null;
    refreshTokenExpiresInSeconds?: number | null;
};

type TokenRefreshFailure = {
    ok: false;
    accessToken: null;
    reason: TokenRefreshFailureReason;
    status?: number;
};

export type TokenRefreshResult = TokenRefreshSuccess | TokenRefreshFailure;

type TokenSetInput = {
    accessToken?: string | null;
    refreshToken?: string | null;
    accessTokenExpiresInSeconds?: number | null;
    refreshTokenExpiresInSeconds?: number | null;
};

const ACCESS_TOKEN_COOKIE = "parqet_access_token";
const REFRESH_TOKEN_COOKIE = "parqet_refresh_token";
export const OAUTH_STATE_COOKIE = "parqet_oauth_state";
export const OAUTH_CODE_VERIFIER_COOKIE = "parqet_oauth_code_verifier";
const DEFAULT_ACCESS_MAX_AGE_SECONDS = 55 * 60;
const DEFAULT_REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const ACCESS_TOKEN_SAFETY_BUFFER_SECONDS = 60;
const DEFAULT_OAUTH_FLOW_MAX_AGE_SECONDS = 10 * 60;

function isProduction(): boolean {
    return process.env.NODE_ENV === "production";
}

function toPositiveInteger(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return null;
    }

    return Math.floor(value);
}

function resolveAccessTokenMaxAge(expiresInSeconds?: number | null): number {
    const parsed = toPositiveInteger(expiresInSeconds);

    if (!parsed) {
        return DEFAULT_ACCESS_MAX_AGE_SECONDS;
    }

    const buffered = parsed - ACCESS_TOKEN_SAFETY_BUFFER_SECONDS;
    return Math.max(60, buffered);
}

function resolveRefreshTokenMaxAge(expiresInSeconds?: number | null): number {
    return toPositiveInteger(expiresInSeconds) ?? DEFAULT_REFRESH_MAX_AGE_SECONDS;
}

export function getParqetTokenCookieOptions(
    kind: TokenCookieKind,
    lifetimes: CookieLifetimeInput = {}
) {
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: isProduction(),
        maxAge:
            kind === "access"
                ? resolveAccessTokenMaxAge(lifetimes.accessTokenExpiresInSeconds)
                : resolveRefreshTokenMaxAge(lifetimes.refreshTokenExpiresInSeconds),
    };
}

export function getParqetOAuthCookieOptions(maxAge = DEFAULT_OAUTH_FLOW_MAX_AGE_SECONDS) {
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: isProduction(),
        maxAge,
    };
}

export function setParqetTokenCookies(
    response: NextResponse,
    input: TokenSetInput
): void {
    if (input.accessToken) {
        response.cookies.set(
            ACCESS_TOKEN_COOKIE,
            input.accessToken,
            getParqetTokenCookieOptions("access", {
                accessTokenExpiresInSeconds: input.accessTokenExpiresInSeconds,
            })
        );
    }

    if (input.refreshToken) {
        response.cookies.set(
            REFRESH_TOKEN_COOKIE,
            input.refreshToken,
            getParqetTokenCookieOptions("refresh", {
                refreshTokenExpiresInSeconds: input.refreshTokenExpiresInSeconds,
            })
        );
    }
}

export function setParqetOAuthFlowCookies(
    response: NextResponse,
    input: {
        state: string;
        codeVerifier: string;
    },
): void {
    response.cookies.set(
        OAUTH_STATE_COOKIE,
        input.state,
        getParqetOAuthCookieOptions(),
    );
    response.cookies.set(
        OAUTH_CODE_VERIFIER_COOKIE,
        input.codeVerifier,
        getParqetOAuthCookieOptions(),
    );
}

export function clearParqetOAuthFlowCookies(response: NextResponse): void {
    response.cookies.set(OAUTH_STATE_COOKIE, "", {
        ...getParqetOAuthCookieOptions(),
        maxAge: 0,
    });
    response.cookies.set(OAUTH_CODE_VERIFIER_COOKIE, "", {
        ...getParqetOAuthCookieOptions(),
        maxAge: 0,
    });
}

export function clearParqetTokenCookies(
    response: NextResponse,
    options: { clearRefreshToken?: boolean } = {}
): void {
    const clearRefreshToken = options.clearRefreshToken ?? true;

    response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
        ...getParqetTokenCookieOptions("access"),
        maxAge: 0,
    });

    if (clearRefreshToken) {
        response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
            ...getParqetTokenCookieOptions("refresh"),
            maxAge: 0,
        });
    }
}

// Diese Funktion liest ein bestimmtes Cookie aus dem Cookie-Header.
export function getCookieValue(
    cookieHeader: string,
    cookieName: string
): string | null {
    const escapedName = cookieName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = cookieHeader.match(new RegExp(`${escapedName}=([^;]+)`));

    return match ? match[1] : null;
}

// Diese Funktion versucht, mit dem Refresh Token einen neuen Access Token zu holen.
export async function refreshParqetAccessToken(
    refreshToken: string
): Promise<TokenRefreshResult> {
    const clientId = process.env.PARQET_CLIENT_ID;

    // Ohne Client ID kann kein Refresh stattfinden.
    if (!clientId) {
        return { ok: false, accessToken: null, reason: "missing_client_id" };
    }

    try {
        const tokenRes = await fetch("https://connect.parqet.com/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: clientId,
            }),
        });

        const rawText = await tokenRes.text();
        let tokenData: Record<string, unknown> = {};

        try {
            tokenData = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
        } catch {
            tokenData = {};
        }

        if (!tokenRes.ok) {
            const oauthError = typeof tokenData.error === "string" ? tokenData.error : "";

            if (
                tokenRes.status === 400 &&
                (oauthError === "invalid_grant" || oauthError === "invalid_request")
            ) {
                return {
                    ok: false,
                    accessToken: null,
                    reason: "invalid_refresh",
                    status: tokenRes.status,
                };
            }

            if (tokenRes.status === 401 || oauthError === "invalid_client") {
                return {
                    ok: false,
                    accessToken: null,
                    reason: "invalid_refresh",
                    status: tokenRes.status,
                };
            }

            if (tokenRes.status === 429 || tokenRes.status >= 500) {
                return {
                    ok: false,
                    accessToken: null,
                    reason: "provider_error",
                    status: tokenRes.status,
                };
            }

            return {
                ok: false,
                accessToken: null,
                reason: "unknown",
                status: tokenRes.status,
            };
        }

        const accessToken = typeof tokenData.access_token === "string"
            ? tokenData.access_token
            : null;

        if (!accessToken) {
            return {
                ok: false,
                accessToken: null,
                reason: "unknown",
                status: tokenRes.status,
            };
        }

        return {
            ok: true,
            accessToken,
            newRefreshToken:
                typeof tokenData.refresh_token === "string"
                    ? tokenData.refresh_token
                    : undefined,
            accessTokenExpiresInSeconds: toPositiveInteger(tokenData.expires_in),
            refreshTokenExpiresInSeconds: toPositiveInteger(
                tokenData.refresh_expires_in
            ),
        };
    } catch {
        return { ok: false, accessToken: null, reason: "network_error" };
    }
}
