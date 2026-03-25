import crypto from "crypto";

export async function GET() {
    const clientId = process.env.PARQET_CLIENT_ID;
    const redirectUri = process.env.PARQET_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return new Response("Missing PARQET_CLIENT_ID or PARQET_REDIRECT_URI", {
            status: 500,
        });
    }

    const codeVerifier = crypto.randomBytes(32).toString("hex");

    const hash = crypto.createHash("sha256").update(codeVerifier).digest();

    const codeChallenge = hash
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "portfolio:read",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state: codeVerifier,
    });

    const url = `https://connect.parqet.com/oauth2/authorize?${params.toString()}`;

    return Response.redirect(url);
}