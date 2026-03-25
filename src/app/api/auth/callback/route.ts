import { NextResponse } from "next/server";

// Diese Route verarbeitet den OAuth-Callback von Parqet.
// Sie tauscht den Authorization Code gegen Tokens aus.
// Danach speichert sie access_token und refresh_token in Cookies
// und leitet den Nutzer auf das Dashboard weiter.

export async function GET(req: Request) {
    try {
        // Die aktuelle URL lesen, damit wir an die Query-Parameter kommen.
        const url = new URL(req.url);

        // Der Authorization Code kommt von Parqet zurück.
        const code = url.searchParams.get("code");

        // Für PKCE haben wir den code_verifier im state transportiert.
        const codeVerifier = url.searchParams.get("state");

        // Ohne diese Werte kann kein Token-Tausch stattfinden.
        if (!code || !codeVerifier) {
            return NextResponse.json(
                {
                    error: "Missing code or verifier",
                    code,
                    codeVerifier,
                },
                { status: 400 }
            );
        }

        // Die notwendigen Umgebungsvariablen laden.
        const clientId = process.env.PARQET_CLIENT_ID;
        const redirectUri = process.env.PARQET_REDIRECT_URI;

        // Wenn eine Variable fehlt, geben wir einen lesbaren Fehler zurück.
        if (!clientId || !redirectUri) {
            return NextResponse.json(
                {
                    error: "Missing environment variables",
                    hasClientId: Boolean(clientId),
                    hasRedirectUri: Boolean(redirectUri),
                },
                { status: 500 }
            );
        }

        // Den Authorization Code gegen Tokens austauschen.
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

        // Die Antwort zuerst als Text lesen, damit Fehler besser sichtbar sind.
        const rawText = await tokenRes.text();

        // Wenn Parqet einen Fehler liefert, geben wir ihn lesbar zurück.
        if (!tokenRes.ok) {
            return NextResponse.json(
                {
                    error: "Token exchange failed",
                    status: tokenRes.status,
                    response: rawText,
                },
                { status: 500 }
            );
        }

        // Die erfolgreiche Antwort als JSON parsen.
        const tokenData = JSON.parse(rawText);

        // Access Token und Refresh Token aus der Antwort holen.
        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;

        // Wenn kein Access Token zurückkommt, geben wir die Fehlersituation zurück.
        if (!accessToken) {
            return NextResponse.json(
                {
                    error: "No access token received",
                    tokenData,
                },
                { status: 500 }
            );
        }

        // Nach erfolgreichem Login leiten wir auf das Dashboard weiter.
        const response = NextResponse.redirect("http://localhost:3000/dashboard");

        // Das Access Token in einem HttpOnly-Cookie speichern.
        response.cookies.set("parqet_access_token", accessToken, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
        });

        // Das Refresh Token ebenfalls speichern, falls vorhanden.
        if (refreshToken) {
            response.cookies.set("parqet_refresh_token", refreshToken, {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
            });
        }

        return response;
    } catch (error) {
        // Unerwartete Fehler lesbar zurückgeben.
        return NextResponse.json(
            {
                error: "Unexpected server error",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}