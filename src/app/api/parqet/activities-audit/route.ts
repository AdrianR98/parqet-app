// src/app/api/parqet/activities-audit/route.ts

import { NextResponse } from "next/server";
import {
    getCookieValue,
    refreshParqetAccessToken,
} from "../../../../lib/parqet";
import { buildActivityContext } from "../../../../lib/parqet-assets/build-activity-context";
import { toNumber } from "../../../../lib/parqet-assets/activity-utils";
import type {
    ActivitiesAuditApiResponse,
    ActivitiesAuditItem,
    ActivitiesAuditSummary,
    AuditActivityType,
} from "../../../../lib/types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

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

function parsePositiveInt(raw: string | null, fallback: number): number {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 1) {
        return fallback;
    }
    return Math.floor(value);
}

function normalizeType(rawType: string): AuditActivityType | null {
    const normalized = rawType.trim().toLowerCase();
    switch (normalized) {
        case "buy":
        case "sell":
        case "dividend":
        case "transfer_in":
        case "transfer_out":
        case "unknown":
            return normalized;
        default:
            return null;
    }
}

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const portfolioIds = url.searchParams.getAll("portfolioId");
        const requestedPage = parsePositiveInt(url.searchParams.get("page"), DEFAULT_PAGE);
        const requestedPageSize = parsePositiveInt(
            url.searchParams.get("pageSize"),
            DEFAULT_PAGE_SIZE
        );
        const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);
        const selectedTypes = url.searchParams
            .getAll("type")
            .map(normalizeType)
            .filter((type): type is AuditActivityType => type !== null);
        const searchTerm = url.searchParams.get("search")?.trim().toLowerCase() ?? "";

        if (portfolioIds.length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    generatedAt: new Date().toISOString(),
                    portfolios: [],
                    items: [],
                    reconciliationWarnings: [],
                    summary: buildAuditSummary([]),
                    pagination: {
                        page: requestedPage,
                        pageSize,
                        totalItems: 0,
                        totalPages: 0,
                        hasNextPage: false,
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
                    summary: buildAuditSummary([]),
                    message: "No access token found.",
                } satisfies ActivitiesAuditApiResponse,
                { status: 401 }
            );
        }

        async function buildAuditView(
            currentAccessToken: string
        ): Promise<ActivitiesAuditApiResponse> {
            const activityContext = await buildActivityContext(
                currentAccessToken,
                portfolioIds
            );
            const portfolios = activityContext.authorizedPortfolios;
            const warnings = activityContext.reconciliationWarnings;

            const projectedItems: ActivitiesAuditItem[] = activityContext.correctedActivities
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
                            ? activityContext.portfolioNameById.get(activity.portfolioId) ??
                              activity.portfolioId
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

            const filteredItems = projectedItems.filter((item) => {
                const matchesType =
                    selectedTypes.length === 0 || selectedTypes.includes(item.type);

                const matchesSearch =
                    searchTerm.length === 0 ||
                    [item.name, item.isin, item.symbol, item.wkn, item.portfolioName]
                        .filter(Boolean)
                        .some((value) => String(value).toLowerCase().includes(searchTerm));

                return matchesType && matchesSearch;
            });

            // Summary semantics: summary is based on the full filtered result set (not only current page)
            const summary = buildAuditSummary(filteredItems);
            const totalItems = filteredItems.length;
            const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
            const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
            const startIndex = (page - 1) * pageSize;
            const pagedItems = filteredItems.slice(startIndex, startIndex + pageSize);

            return {
                ok: true,
                generatedAt: new Date().toISOString(),
                portfolios,
                items: pagedItems,
                reconciliationWarnings: warnings,
                summary,
                pagination: {
                    page,
                    pageSize,
                    totalItems,
                    totalPages,
                    hasNextPage: totalPages > 0 && page < totalPages,
                },
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
                        summary: buildAuditSummary([]),
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
                summary: buildAuditSummary([]),
                message: "Activities audit route failed.",
                details: error instanceof Error ? error.message : String(error),
            } satisfies ActivitiesAuditApiResponse,
            { status: 500 }
        );
    }
}
