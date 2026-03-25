// Diese Hilfsdatei enthaelt Funktionen fuer den Umgang mit Parqet-Tokens.

type TokenRefreshResult = {
    accessToken: string | null;
    newAccessToken?: string;
    newRefreshToken?: string;
};

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
        return { accessToken: null };
    }

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

    // Wenn Parqet keinen Erfolg liefert, ist der Refresh fehlgeschlagen.
    if (!tokenRes.ok) {
        return { accessToken: null };
    }

    const tokenData = await tokenRes.json();

    return {
        accessToken: tokenData.access_token ?? null,
        newAccessToken: tokenData.access_token,
        newRefreshToken: tokenData.refresh_token,
    };
}