// ============================================================
// src/app/api/parqet/assets/audit/route.ts
// ------------------------------------------------------------
// Read-only Audit-Route fuer ein einzelnes Asset.
//
// Ziel:
// - alle normalisierten Activities eines Assets laden
// - Reconciliation-Warnungen fuer dieses Asset anzeigen
// - Grundlage fuer spaeteres Override-System schaffen
// ============================================================

import { NextResponse } from "next/server";
import {
    getCookieValue,
    refreshParqetAccessToken,
} from "../../../../../lib/parqet";
import { fetchAuthorizedPortfolios } from "../../../../../lib/parqet-assets/fetch-portfolios";
import { loadActivitiesForPortfolios } from "../../../../../lib/parqet-assets/fetch-activities";
import { isRealSecurityActivity } from "../../../../../lib/parqet-assets/filters";
import { normalizeActivities } from "../../../../../lib/parqet-assets/normalization";
import { applyOverrides } from "../../../../../lib/parqet-assets/overrides";
import { buildReconciliationWarnings } from "../../../../../lib/parqet-assets/reconciliation";
import type {
    ActivitiesAuditApiResponse,
    ActivitiesAuditItem,
    ActivitiesAuditSummary,
    ReconciliationWarning,
} from "../../../../../lib/types";

// ============================================================
// Helper
// ============================================================

function getMonthKey(value: string): string {
    return value.slice(0, 7);
}

function getMonthLabel(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value.slice(0, 7);
    }

    return new Intl.DateTimeFormat("de-DE", {
        month: "long",
        year: "numeric",
    }).format(date);
}

function toNumber(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
}

function buildAuditSummary(items: ActivitiesAuditItem[]): ActivitiesAuditSummary {
    return {
        total: items.length,
        buyCount: items.filter((item) => item.type === "buy").length,
        sellCount: items.filter((item) => item.type === "sell").length,
        dividendCount: items.filter((item) => item.type === "dividend").length,
        transferInCount: items.filter((item) => item.type === "transfer_in").length,
        transferOutCount: items.filter((item) => item.type === "transfer_out").length,
        unknownCount: items.filter((item) => item.type === "unknown").length,
    };
}

// ============================================================
// GET /api/parqet/assets/audit?portfolioId=...&isin=...
// ============================================================

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const portfolioIds = url.searchParams.getAll("portfolioId");
        const isin = (url.searchParams.get("isin") || "").trim().toUpperCase();

        if (!isin) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "Missing isin parameter.",
                },
                { status: 400 }
            );
        }

        if (portfolioIds.length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No portfolioId parameters provided.",
                },
                { status: 400 }
            );
        }

        const cookieHeader = req.headers.get("cookie") || "";

        let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
        const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

        if (!accessToken) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No access token found.",
                },
                { status: 401 }
            );
        }

        async function buildAuditView(currentAccessToken: string): Promise<ActivitiesAuditApiResponse> {
            const portfolios = await fetchAuthorizedPortfolios(currentAccessToken);
            const portfolioNameById = new Map<string, string>();

            for (const portfolio of portfolios) {
                portfolioNameById.set(portfolio.id, portfolio.name);
            }

            const allActivities = await loadActivitiesForPortfolios(
                currentAccessToken,
                portfolioIds
            );

            const filteredActivities = allActivities.filter(isRealSecurityActivity);
            const normalized = normalizeActivities(filteredActivities);
            const corrected = applyOverrides(normalized);
            const warnings = buildReconciliationWarnings(corrected);

            const items: ActivitiesAuditItem[] = corrected
                .filter((activity) => (activity.isin || "").trim().toUpperCase() === isin)
                .map((activity) => {
                    const datetime = activity.datetime ?? "";
                    const rawWarnings: ReconciliationWarning[] = warnings.filter(
                        (warning) => warning.isin === isin
                    );

                    return {
                        id: activity.id,
                        datetime,
                        year: new Date(datetime).getFullYear(),
                        monthKey: getMonthKey(datetime),
                        monthLabel: getMonthLabel(datetime),

                        portfolioId: activity.portfolioId ?? null,
                        portfolioName: activity.portfolioId
                            ? portfolioNameById.get(activity.portfolioId) ?? activity.portfolioId
                            : "Unknown Portfolio",

                        isin,
                        name:
                            activity.name ??
                            activity.symbol ??
                            activity.wkn ??
                            isin,
                        symbol: activity.symbol ?? null,
                        wkn: activity.wkn ?? null,

                        type: activity.type ?? "unknown",
                        rawType: activity.rawType ?? activity.type ?? "unknown",

                        shares: toNumber(activity.shares),
                        price: toNumber(activity.price),
                        amount: toNumber(activity.amount),
                        amountNet: toNumber(activity.amountNet),

                        warningMessages: rawWarnings.map((warning) => warning.message),
                    };
                })
                .sort((a, b) => a.datetime.localeCompare(b.datetime));

            return {
                ok: true,
                generatedAt: new Date().toISOString(),
                portfolios,
                items,
                reconciliationWarnings: warnings.filter((warning) => warning.isin === isin),
                summary: buildAuditSummary(items),
            };
        }

        try {
            const result = await buildAuditView(accessToken);
            return NextResponse.json(result);
        } catch (error) {
            if (!refreshToken) {
                throw error;
            }

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
            const result = await buildAuditView(accessToken);

            const response = NextResponse.json(result);

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
    } catch (error: unknown) {
        return NextResponse.json(
            {
                ok: false,
                generatedAt: new Date().toISOString(),
                portfolios: [],
                items: [],
                reconciliationWarnings: [],
                summary: {
                    total: 0,
                    buyCount: 0,
                    sellCount: 0,
                    dividendCount: 0,
                    transferInCount: 0,
                    transferOutCount: 0,
                    unknownCount: 0,
                },
                message: "Asset audit route failed.",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}