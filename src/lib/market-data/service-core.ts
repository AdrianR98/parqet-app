import type { MarketDataProvider, MarketDataResponse } from "./types";

export function buildCacheMissResponse(input: { provider: MarketDataProvider; symbol: string }): MarketDataResponse {
    return {
        ok: false,
        status: "cache_miss",
        message: "Für dieses Asset liegen keine historischen Kursdaten vor.",
        diagnostics: {
            provider: input.provider,
            symbol: input.symbol,
            providerStatusCategory: "not_requested",
            detectedResponseShape: "none",
        },
    };
}
