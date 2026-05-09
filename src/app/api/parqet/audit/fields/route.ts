import { NextResponse } from "next/server";
import { getCookieValue, refreshParqetAccessToken } from "../../../../../lib/parqet";
import { buildParqetApiFieldAudit } from "../../../../../lib/parqet/audit/fieldAudit";

const PARQET_BASE_URL = "https://connect.parqet.com";

function jsonError(status: number, code: string, message: string) {
    return NextResponse.json(
        {
            ok: false,
            code,
            message,
        },
        { status }
    );
}

function isProduction() {
    return process.env.NODE_ENV === "production";
}

function isAuditEnabled() {
    return process.env.ENABLE_PARQET_AUDIT_ROUTES === "true";
}

async function fetchJson(accessToken: string, url: string): Promise<unknown> {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error(`PARQET_FETCH_${response.status}`);
    }

    return response.json();
}

async function fetchPortfolios(accessToken: string): Promise<unknown[]> {
    const data = await fetchJson(accessToken, `${PARQET_BASE_URL}/portfolios`);

    if (Array.isArray(data)) {
        return data;
    }

    if (data && typeof data === "object" && "portfolios" in data) {
        const portfolios = (data as { portfolios?: unknown }).portfolios;
        return Array.isArray(portfolios) ? portfolios : [];
    }

    return [];
}

function extractPortfolioId(portfolio: unknown): string | null {
    if (!portfolio || typeof portfolio !== "object") {
        return null;
    }

    const candidate = (portfolio as { id?: unknown; portfolioId?: unknown }).id ??
        (portfolio as { portfolioId?: unknown }).portfolioId;

    return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

async function fetchAllActivitiesForPortfolio(accessToken: string, portfolioId: string): Promise<unknown[]> {
    const allActivities: unknown[] = [];
    let cursor: string | null = null;

    while (true) {
        const url = new URL(`${PARQET_BASE_URL}/portfolios/${portfolioId}/activities`);

        if (cursor) {
            url.searchParams.set("cursor", cursor);
        }

        const data = await fetchJson(accessToken, url.toString());

        if (!data || typeof data !== "object") {
            break;
        }

        const activities = (data as { activities?: unknown }).activities;
        if (Array.isArray(activities)) {
            allActivities.push(...activities);
        }

        const nextCursor = (data as { cursor?: unknown }).cursor;
        cursor = typeof nextCursor === "string" && nextCursor ? nextCursor : null;

        if (!cursor) {
            break;
        }
    }

    return allActivities;
}

async function fetchActivitiesForPortfolios(accessToken: string, portfolios: unknown[]): Promise<unknown[]> {
    const allActivities: unknown[] = [];

    for (const portfolio of portfolios) {
        const portfolioId = extractPortfolioId(portfolio);

        if (!portfolioId) {
            continue;
        }

        const activities = await fetchAllActivitiesForPortfolio(accessToken, portfolioId);
        allActivities.push(...activities);
    }

    return allActivities;
}

async function loadAuditSources(accessToken: string) {
    const portfolios = await fetchPortfolios(accessToken);
    const activities = await fetchActivitiesForPortfolios(accessToken, portfolios);

    return {
        portfolios,
        activities,
        holdingsOrAssetsNote:
            "Holdings/assets are not audited in P1-1 because no safe existing internal fetch function is available without broadening the route scope.",
    };
}

function buildAuditResponse(accessToken: string) {
    return loadAuditSources(accessToken).then((sources) =>
        buildParqetApiFieldAudit({
            portfolios: sources.portfolios,
            activities: sources.activities,
            holdingsOrAssetsNote: sources.holdingsOrAssetsNote,
            environment: process.env.NODE_ENV === "development" ? "development" : "other-non-production",
        })
    );
}

export async function GET(req: Request) {
    if (isProduction()) {
        return jsonError(404, "NOT_FOUND", "Not found.");
    }

    if (!isAuditEnabled()) {
        return jsonError(403, "AUDIT_ROUTE_DISABLED", "Parqet audit routes are disabled.");
    }

    const cookieHeader = req.headers.get("cookie") || "";
    let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
    const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

    if (!accessToken) {
        return jsonError(401, "PARQET_AUTH_REQUIRED", "Parqet connection is required.");
    }

    try {
        const audit = await buildAuditResponse(accessToken);
        return NextResponse.json({ ok: true, audit });
    } catch (error) {
        const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

        if (message === "PARQET_FETCH_401" && refreshToken) {
            const refreshed = await refreshParqetAccessToken(refreshToken);

            if (!refreshed.accessToken) {
                return jsonError(401, "PARQET_AUTH_REQUIRED", "Parqet connection must be refreshed.");
            }

            accessToken = refreshed.accessToken;
            const audit = await buildAuditResponse(accessToken);
            const response = NextResponse.json({ ok: true, refreshed: true, audit });

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

        if (message.startsWith("PARQET_FETCH_")) {
            return jsonError(502, "PARQET_UPSTREAM_ERROR", "Parqet audit source could not be loaded.");
        }

        return jsonError(500, "AUDIT_FAILED", "Parqet API field audit failed.");
    }
}
