// src/app/api/parqet/activities-audit/route.ts

import { NextResponse } from "next/server";
import {
    getCookieValue,
    refreshParqetAccessToken,
} from "../../../../lib/parqet";
import { fetchAuthorizedPortfolios } from "../../../../lib/parqet-assets/fetch-portfolios";
import { loadActivitiesForPortfolios } from "../../../../lib/parqet-assets/fetch-activities";
import { isRealSecurityActivity } from "../../../../lib/parqet-assets/filters";
import { normalizeActivities } from "../../../../lib/parqet-assets/normalization";
import { applyOverrides } from "../../../../lib/parqet-assets/overrides";
import { buildReconciliationWarnings } from "../../../../lib/parqet-assets/reconciliation";
import { toNumber } from "../../../../lib/parqet-assets/activity-utils";
import type {
    ActivitiesAuditApiResponse,
    ActivitiesAuditItem,
    ActivitiesAuditSummary,
} from "../../../../lib/types";
import { readActivityOverrides } from "../../../../lib/parqet-assets/override-store";

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

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const portfolioIds = url.searchParams.getAll("portfolioId");

        if (portfolioIds.length === 0) {
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
                    message: "No portfolioId parameters provided.",
                } satisfies ActivitiesAuditApiResponse,
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
                    message: "No access token found.",
                } satisfies ActivitiesAuditApiResponse,
                { status: 401 }
            );
        }

        async function buildAuditView(
            currentAccessToken: string
        ): Promise<ActivitiesAuditApiResponse> {
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
            const overrides = await readActivityOverrides();
            const corrected = applyOverrides(normalized, overrides);
            const warnings = buildReconciliationWarnings(corrected);

            const items: ActivitiesAuditItem[] = corrected
                .map((activity) => {
                    const datetime = activity.datetime ?? "";
                    const isin = (activity.isin ?? "").trim().toUpperCase();

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
                        name: activity.name ?? activity.symbol ?? activity.wkn ?? isin,
                        symbol: activity.symbol ?? null,
                        wkn: activity.wkn ?? null,

                        type: activity.type ?? "unknown",
                        rawType: activity.rawType ?? activity.type ?? "unknown",

                        shares: toNumber(activity.shares),
                        price: toNumber(activity.price),
                        amount: toNumber(activity.amount),
                        amountNet: toNumber(activity.amountNet),

                        warningMessages: warnings
                            .filter((warning) => warning.isin === isin)
                            .map((warning) => warning.message),

                        hasOverrides: activity.hasOverrides,
                        overrideFlags: activity.overrideFlags,
                        overrideCount: activity.appliedOverrides?.length ?? 0,
                    };
                })
                .sort((a, b) => b.datetime.localeCompare(a.datetime));

            return {
                ok: true,
                generatedAt: new Date().toISOString(),
                portfolios,
                items,
                reconciliationWarnings: warnings,
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
                        message: "Access token expired and refresh failed.",
                    } satisfies ActivitiesAuditApiResponse,
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
                message: "Activities audit route failed.",
                details: error instanceof Error ? error.message : String(error),
            } satisfies ActivitiesAuditApiResponse,
            { status: 500 }
        );
    }
}