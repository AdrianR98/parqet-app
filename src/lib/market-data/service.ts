import "server-only";

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

export async function getMarketDataHistory(input: { isin: string; refresh: boolean }): Promise<MarketDataResponse> {
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
