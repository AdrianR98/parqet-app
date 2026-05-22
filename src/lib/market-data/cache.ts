import type { MarketDataCacheEntry, MarketDataCacheMetadata, MarketDataProvider, MarketDataQuotaInfo } from "./types";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const REFRESH_DEDUP_MS = 5 * 60 * 1000;
export const DAILY_PROVIDER_LIMIT = 20;

type CacheKeyInput = {
    provider: MarketDataProvider;
    symbol: string;
    isin: string;
};

type QuotaState = {
    dayUtc: string;
    used: number;
};

const marketDataCache = new Map<string, MarketDataCacheEntry>();
const lastRefreshByKey = new Map<string, number>();
const quotaByProvider = new Map<MarketDataProvider, QuotaState>();

function utcDayKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function getCacheKey(input: CacheKeyInput): string {
    return `${input.provider}:${input.symbol}:${input.isin}`;
}

export function getCachedSeries(key: string): MarketDataCacheEntry | null {
    return marketDataCache.get(key) ?? null;
}

export function setCachedSeries(key: string, entry: MarketDataCacheEntry): void {
    marketDataCache.set(key, entry);
}

export function getCacheMetadata(entry: MarketDataCacheEntry, ttlMs: number = DEFAULT_TTL_MS): MarketDataCacheMetadata {
    const ageMs = Date.now() - new Date(entry.refreshedAt).getTime();

    return {
        refreshedAt: entry.refreshedAt,
        isFresh: Number.isFinite(ageMs) && ageMs >= 0 ? ageMs < ttlMs : false,
        ageHours: Number.isFinite(ageMs) ? Number((Math.max(ageMs, 0) / (60 * 60 * 1000)).toFixed(2)) : Number.POSITIVE_INFINITY,
        provider: entry.provider,
        symbol: entry.symbol,
        pointCount: entry.points.length,
    };
}

export function shouldSkipRapidRefresh(key: string): boolean {
    const lastRefreshAt = lastRefreshByKey.get(key);

    if (!lastRefreshAt) {
        return false;
    }

    return Date.now() - lastRefreshAt < REFRESH_DEDUP_MS;
}

export function recordRefreshAttempt(key: string): void {
    lastRefreshByKey.set(key, Date.now());
}

function getQuotaState(provider: MarketDataProvider): QuotaState {
    const today = utcDayKey(new Date());
    const current = quotaByProvider.get(provider);

    if (!current || current.dayUtc !== today) {
        const next = { dayUtc: today, used: 0 };
        quotaByProvider.set(provider, next);
        return next;
    }

    return current;
}

export function getQuotaInfo(provider: MarketDataProvider): MarketDataQuotaInfo {
    const state = getQuotaState(provider);

    return {
        provider,
        dailyLimit: DAILY_PROVIDER_LIMIT,
        usedToday: state.used,
        remainingToday: Math.max(0, DAILY_PROVIDER_LIMIT - state.used),
        dayUtc: state.dayUtc,
    };
}

export function canConsumeQuota(provider: MarketDataProvider): boolean {
    const state = getQuotaState(provider);
    return state.used < DAILY_PROVIDER_LIMIT;
}

export function consumeQuota(provider: MarketDataProvider): void {
    const state = getQuotaState(provider);
    state.used += 1;
}

export const MARKET_DATA_CACHE_TTL_MS = DEFAULT_TTL_MS;

export function resetMarketDataInMemoryStateForTests(): void {
    marketDataCache.clear();
    lastRefreshByKey.clear();
    quotaByProvider.clear();
}
