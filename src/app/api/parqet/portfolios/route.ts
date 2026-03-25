import { NextResponse } from "next/server";
import {
    getCookieValue,
    refreshParqetAccessToken,
} from "../../../../lib/parqet";

// Diese Route laedt die autorisierten Portfolios von Parqet.
// Wenn der Access Token abgelaufen ist, wird automatisch ein Refresh versucht.
export async function GET(req: Request) {
    try {
        const cookieHeader = req.headers.get("cookie") || "";

        let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
        const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

        if (!accessToken) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No access token found in cookies.",
                },
                { status: 401 }
            );
        }

        async function fetchPortfolios(currentAccessToken: string) {
            return fetch("https://connect.parqet.com/portfolios", {
                headers: {
                    Authorization: `Bearer ${currentAccessToken}`,
                },
            });
        }

        let portfoliosRes = await fetchPortfolios(accessToken);

        // Wenn der Token abgelaufen ist, Refresh versuchen.
        if (portfoliosRes.status === 401 && refreshToken) {
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
            portfoliosRes = await fetchPortfolios(accessToken);

            const rawText = await portfoliosRes.text();

            if (!portfoliosRes.ok) {
                return NextResponse.json(
                    {
                        ok: false,
                        message: "Failed to load portfolios from Parqet after refresh.",
                        status: portfoliosRes.status,
                        response: rawText,
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

        const rawText = await portfoliosRes.text();

        if (!portfoliosRes.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Failed to load portfolios from Parqet.",
                    status: portfoliosRes.status,
                    response: rawText,
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
    } catch (error: unknown) {
        return NextResponse.json(
            {
                ok: false,
                message: "Unexpected server error while loading portfolios.",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}