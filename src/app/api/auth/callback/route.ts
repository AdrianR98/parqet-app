import { NextResponse } from "next/server";
import {
    clearParqetOAuthFlowCookies,
    getCookieValue,
    OAUTH_CODE_VERIFIER_COOKIE,
    OAUTH_STATE_COOKIE,
    setParqetTokenCookies,
} from "../../../../lib/parqet";

// Diese Route verarbeitet den OAuth-Callback von Parqet.
// Sie tauscht den Authorization Code gegen Tokens aus.
// Danach speichert sie access_token und refresh_token in Cookies
// und leitet den Nutzer auf das Dashboard weiter.

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const cookieHeader = req.headers.get("cookie") || "";
        const storedState = getCookieValue(cookieHeader, OAUTH_STATE_COOKIE);
        const codeVerifier = getCookieValue(cookieHeader, OAUTH_CODE_VERIFIER_COOKIE);

        if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
            const response = NextResponse.json(
                {
                    error: "Ungültiger OAuth-Status. Bitte den Verbindungsaufbau erneut starten.",
                },
                { status: 400 }
            );
            clearParqetOAuthFlowCookies(response);
            return response;
        }

        const clientId = process.env.PARQET_CLIENT_ID;
        const redirectUri = process.env.PARQET_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            const response = NextResponse.json(
                {
                    error: "OAuth-Konfiguration fehlt.",
                },
                { status: 500 }
            );
            clearParqetOAuthFlowCookies(response);
            return response;
        }

        const tokenRes = await fetch("https://connect.parqet.com/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                client_id: clientId,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            }),
        });

        const rawText = await tokenRes.text();

        if (!tokenRes.ok) {
            const response = NextResponse.json(
                {
                    error: "Token exchange failed",
                    status: tokenRes.status,
                },
                { status: 500 }
            );
            clearParqetOAuthFlowCookies(response);
            return response;
        }

        const tokenData = JSON.parse(rawText) as {
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
            refresh_expires_in?: number;
        };

        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;

        if (!accessToken) {
            const response = NextResponse.json(
                {
                    error: "No access token received",
                },
                { status: 500 }
            );
            clearParqetOAuthFlowCookies(response);
            return response;
        }

        const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
        const redirectBase =
            configuredAppUrl && configuredAppUrl.length > 0
                ? configuredAppUrl
                : url.origin;
        const redirectTarget = new URL("/dashboard", redirectBase);
        const response = NextResponse.redirect(redirectTarget);

        setParqetTokenCookies(response, {
            accessToken,
            refreshToken,
            accessTokenExpiresInSeconds: tokenData.expires_in ?? null,
            refreshTokenExpiresInSeconds: tokenData.refresh_expires_in ?? null,
        });
        clearParqetOAuthFlowCookies(response);

        return response;
    } catch {
        const response = NextResponse.json(
            {
                error: "Unerwarteter OAuth-Fehler.",
            },
            { status: 500 }
        );
        clearParqetOAuthFlowCookies(response);
        return response;
    }
}
