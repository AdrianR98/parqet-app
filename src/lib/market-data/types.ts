export type MarketDataProvider = "alphavantage" | "yfinance";
export type MarketHistoryPeriod = "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "MAX";

export type MarketDataPoint = {
    date: string;
    close: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number | null;
    currency?: string | null;
};

export type MarketDataAction = {
    actionType: "dividend";
    date: string;
    amount: number;
    currency?: string | null;
};

export type MarketDataSeries = {
    provider: MarketDataProvider;
    symbol: string;
    isin: string;
    points: MarketDataPoint[];
    actions?: MarketDataAction[];
    refreshedAt: string;
    source: string;
};

export type MarketDataStatus =
    | "cache_miss"
    | "db_hit"
    | "missing_instrument"
    | "missing_primary_mapping"
    | "primary_without_prices"
    | "no_prices"
    | "excluded"
    | "legacy"
    | "derivative"
    | "unknown"
    | "db_unavailable"
    | "not_available"
    | "invalid_request";

export type MarketDataCacheStatus =
    | "ready"
    | "stale"
    | "missing_symbol"
    | "missing_api_key"
    | "provider_error"
    | "rate_limited"
    | "not_found"
    | "invalid_request";

export type MarketDataCacheEntry = {
    isin: string;
    symbol: string;
    provider: MarketDataProvider;
    points: MarketDataPoint[];
    refreshedAt: string;
    status: MarketDataCacheStatus;
    errorCategory?: "provider_error" | "rate_limited" | "not_found" | "invalid_request" | "missing_api_key";
    errorMessage?: string;
};

export type MarketDataCacheMetadata = {
    refreshedAt: string;
    isFresh: boolean;
    ageHours: number;
    provider: MarketDataProvider;
    symbol: string;
    pointCount: number;
};

export type MarketDataQuotaInfo = {
    provider: MarketDataProvider;
    dailyLimit: number;
    usedToday: number;
    remainingToday: number;
    dayUtc: string;
};

export type MarketDataResponse = {
    ok: boolean;
    data?: MarketDataSeries;
    status: MarketDataStatus;
    message?: string;
    metadata?: {
        isin: string;
        provider: string | null;
        symbol: string | null;
        exchange: string | null;
        currency: string | null;
        mappingStatus:
            | "ok"
            | "missing_instrument"
            | "missing_primary_mapping"
            | "primary_without_prices"
            | "no_prices"
            | "excluded"
            | "legacy"
            | "derivative"
            | "unknown"
            | "db_unavailable";
        marketDataStatus: "active" | "excluded" | "legacy" | "derivative" | "unknown" | null;
        marketDataStatusReason: string | null;
        latestPriceDate: string | null;
        pointCount: number;
        requestedPeriod?: MarketHistoryPeriod;
        fromDate?: string | null;
        toDate?: string | null;
        pointCountRaw?: number;
        pointCountReturned?: number;
        downsampled?: boolean;
        stale: boolean;
    };
    cache?: MarketDataCacheMetadata;
    quota?: MarketDataQuotaInfo;
    diagnostics?: MarketDataDiagnostics;
};

export type MarketDataResponseShape =
    | "none"
    | "daily"
    | "daily_adjusted"
    | "note"
    | "information"
    | "error_message"
    | "unexpected";

export type MarketDataDiagnostics = {
    provider: MarketDataProvider;
    symbol: string;
    providerStatusCategory:
        | "not_requested"
        | "ok"
        | "missing_api_key"
        | "rate_limited"
        | "not_found"
        | "invalid_request"
        | "provider_error";
    detectedResponseShape: MarketDataResponseShape;
    pointCount?: number;
};

export type MarketSymbolOverride = {
    isin: string;
    provider: MarketDataProvider;
    symbol: string;
    name?: string;
};

export type MarketSymbolResolution =
    | {
        ok: true;
        isin: string;
        provider: MarketDataProvider;
        symbol: string;
        name?: string;
    }
    | {
        ok: false;
        isin: string;
        status: "missing_symbol" | "invalid_request";
        message: string;
    };

export type ProviderFetchResult =
    | {
        ok: true;
        points: MarketDataPoint[];
        source: string;
        refreshedAt: string;
        diagnostics: MarketDataDiagnostics;
      }
    | {
        ok: false;
        status: "missing_api_key" | "provider_error" | "rate_limited" | "not_found" | "invalid_request";
        message: string;
        diagnostics: MarketDataDiagnostics;
      };
