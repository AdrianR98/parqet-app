import "server-only";

import { getDailyPricesByIsin, getMarketActionsByIsin, getPrimarySymbolMappingByIsin, MarketDataRepositoryError } from "./db/repository";
import {
    canConsumeQuota,
    consumeQuota,
    getCachedSeries,
    getCacheKey,
    getCacheMetadata,
    getQuotaInfo,
    MARKET_DATA_CACHE_TTL_MS,
    recordRefreshAttempt,
    setCachedSeries,
    shouldSkipRapidRefresh,
} from "./cache";
import { fetchAlphaVantageDailySeries } from "./alpha-vantage";
import { buildCacheMissResponse } from "./service-core";
import { resolveMarketSymbolForIsin } from "./symbol-mapping";
import type { MarketDataCacheEntry, MarketDataResponse } from "./types";

function toKnownProvider(provider: string): "alphavantage" | "yfinance" | null {
    if (provider === "alphavantage" || provider === "yfinance") {
        return provider;
    }
    return null;
}

async function readPostgresMarketData(isin: string): Promise<{
    points: Awaited<ReturnType<typeof getDailyPricesByIsin>>;
    actions: Awaited<ReturnType<typeof getMarketActionsByIsin>>;
    symbol: string;
    provider: "alphavantage" | "yfinance";
    firstDate: string;
    lastDate: string;
} | null> {
    const points = await getDailyPricesByIsin({ isin });
    if (points.length === 0) {
        return null;
    }
    const actions = await getMarketActionsByIsin({ isin });

    const latestPoint = points[points.length - 1];
    const provider = toKnownProvider(latestPoint.provider) ?? "yfinance";
    const symbol = latestPoint.symbol;
    const firstDate = points[0].date;
    const lastDate = latestPoint.date;

    return {
        points,
        actions,
        symbol,
        provider,
        firstDate,
        lastDate,
    };
}

export async function getMarketDataHistory(input: { isin: string; refresh: boolean }): Promise<MarketDataResponse> {
    try {
        const dbData = await readPostgresMarketData(input.isin);
        if (dbData) {
            return {
                ok: true,
                status: "db_hit",
                message: "Kursdaten aus lokaler Kursdatenbank.",
                data: {
                    provider: dbData.provider,
                    isin: input.isin.replace(/\s+/g, "").toUpperCase(),
                    symbol: dbData.symbol,
                    points: dbData.points.map((point) => ({
                        date: point.date,
                        open: point.open ?? undefined,
                        high: point.high ?? undefined,
                        low: point.low ?? undefined,
                        close: point.close,
                        volume: point.volume,
                        currency: point.currency,
                    })),
                    actions: dbData.actions
                        .filter((action) => action.actionType === "dividend" && action.amount != null && Number.isFinite(action.amount))
                        .map((action) => ({
                            actionType: "dividend",
                            date: action.date,
                            amount: Number(action.amount),
                            currency: action.currency,
                        })),
                    refreshedAt: dbData.points[dbData.points.length - 1].importedAt,
                    source: "postgres",
                },
                cache: {
                    refreshedAt: dbData.points[dbData.points.length - 1].importedAt,
                    isFresh: true,
                    ageHours: 0,
                    provider: dbData.provider,
                    symbol: dbData.symbol,
                    pointCount: dbData.points.length,
                },
                diagnostics: {
                    provider: dbData.provider,
                    symbol: dbData.symbol,
                    providerStatusCategory: "ok",
                    detectedResponseShape: "none",
                    pointCount: dbData.points.length,
                },
            };
        }

        const primaryMapping = await getPrimarySymbolMappingByIsin(input.isin);
        if (primaryMapping?.provider === "yfinance") {
            if (input.refresh) {
                return {
                    ok: false,
                    status: "cache_miss",
                    message: "Kursdaten werden künftig über den Datenimport aktualisiert.",
                    diagnostics: {
                        provider: "yfinance",
                        symbol: primaryMapping.symbol,
                        providerStatusCategory: "not_requested",
                        detectedResponseShape: "none",
                    },
                };
            }

            return {
                ok: false,
                status: "cache_miss",
                message: "Für dieses Asset liegen noch keine Kursdaten in der lokalen Kursdatenbank vor.",
                diagnostics: {
                    provider: "yfinance",
                    symbol: primaryMapping.symbol,
                    providerStatusCategory: "not_requested",
                    detectedResponseShape: "none",
                },
            };
        }
    } catch (error) {
        if (!(error instanceof MarketDataRepositoryError) || error.code !== "missing_db_config") {
            return {
                ok: false,
                status: "provider_error",
                message: "Kursdaten konnten nicht geladen werden.",
            };
        }
    }

    const symbolResolution = await resolveMarketSymbolForIsin(input.isin);

    if (!symbolResolution.ok) {
        return {
            ok: false,
            status: symbolResolution.status,
            message: symbolResolution.message,
        };
    }

    const cacheKey = getCacheKey(symbolResolution);
    const cached = getCachedSeries(cacheKey);

    if (cached) {
        const cacheMeta = getCacheMetadata(cached, MARKET_DATA_CACHE_TTL_MS);

        if (!input.refresh) {
            return {
                ok: true,
                status: "cache_hit",
                message: "Kursdaten aus lokalem Cache.",
                data: {
                    provider: cached.provider,
                    isin: cached.isin,
                    symbol: cached.symbol,
                    points: cached.points,
                    refreshedAt: cached.refreshedAt,
                    source: "memory-cache",
                },
                cache: cacheMeta,
                quota: getQuotaInfo(cached.provider),
            };
        }

        if (input.refresh && shouldSkipRapidRefresh(cacheKey)) {
            return {
                ok: true,
                status: "cache_hit",
                message: "Kursdaten aus lokalem Cache.",
                data: {
                    provider: cached.provider,
                    isin: cached.isin,
                    symbol: cached.symbol,
                    points: cached.points,
                    refreshedAt: cached.refreshedAt,
                    source: "memory-cache",
                },
                cache: cacheMeta,
                quota: getQuotaInfo(cached.provider),
            };
        }
    }

    if (!input.refresh) {
        return {
            ...buildCacheMissResponse({
                provider: symbolResolution.provider,
                symbol: symbolResolution.symbol,
            }),
            quota: getQuotaInfo(symbolResolution.provider),
        };
    }

    const provider = symbolResolution.provider;

    if (!canConsumeQuota(provider)) {
        if (cached) {
            return {
                ok: true,
                status: "rate_limited",
                message: "Alpha-Vantage-Tageslimit erreicht. Es wurden keine neuen Kursdaten abgefragt.",
                data: {
                    provider: cached.provider,
                    isin: cached.isin,
                    symbol: cached.symbol,
                    points: cached.points,
                    refreshedAt: cached.refreshedAt,
                    source: "memory-cache-stale",
                },
                cache: getCacheMetadata(cached, MARKET_DATA_CACHE_TTL_MS),
                quota: getQuotaInfo(provider),
            };
        }

        return {
            ok: false,
            status: "rate_limited",
            message: "Alpha-Vantage-Tageslimit erreicht. Es wurden keine neuen Kursdaten abgefragt.",
            quota: getQuotaInfo(provider),
        };
    }

    consumeQuota(provider);
    recordRefreshAttempt(cacheKey);

    const providerResult = await fetchAlphaVantageDailySeries(symbolResolution.symbol);

    if (!providerResult.ok) {
        if (cached) {
            return {
                ok: true,
                status: providerResult.status,
                message: providerResult.message,
                data: {
                    provider: cached.provider,
                    isin: cached.isin,
                    symbol: cached.symbol,
                    points: cached.points,
                    refreshedAt: cached.refreshedAt,
                    source: "memory-cache-stale",
                },
                cache: getCacheMetadata(cached, MARKET_DATA_CACHE_TTL_MS),
                quota: getQuotaInfo(provider),
                diagnostics: providerResult.diagnostics,
            };
        }

        return {
            ok: false,
            status: providerResult.status,
            message: providerResult.message,
            quota: getQuotaInfo(provider),
            diagnostics: providerResult.diagnostics,
        };
    }

    const cacheEntry: MarketDataCacheEntry = {
        isin: symbolResolution.isin,
        symbol: symbolResolution.symbol,
        provider,
        points: providerResult.points,
        refreshedAt: providerResult.refreshedAt,
        status: "ready",
    };

    setCachedSeries(cacheKey, cacheEntry);

    return {
        ok: true,
        status: "refreshed",
        message: "Kursdaten wurden aktualisiert.",
        data: {
            provider,
            isin: symbolResolution.isin,
            symbol: symbolResolution.symbol,
            points: providerResult.points,
            refreshedAt: providerResult.refreshedAt,
            source: providerResult.source,
        },
        cache: getCacheMetadata(cacheEntry, MARKET_DATA_CACHE_TTL_MS),
        quota: getQuotaInfo(provider),
        diagnostics: providerResult.diagnostics,
    };
}
