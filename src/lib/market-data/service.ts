import "server-only";

import {
    getLatestDailyPriceDateByIsin,
    getDailyPricesByIsin,
    getInstrumentByIsin,
    getMarketActionsByIsin,
    getPrimarySymbolMappingByIsin,
    MarketDataRepositoryError,
} from "./db/repository";
import { downsampleHistoryPoints, resolveFromDateForPeriod, type HistoryPeriod } from "./history-utils";
import type { MarketDataResponse } from "./types";

function normalizeLookupIsin(value: string): string {
    return value.replace(/\s+/g, "").toUpperCase();
}

function isStaleLatestDate(latestPriceDate: string | null): boolean {
    if (!latestPriceDate) {
        return false;
    }

    const latestDate = new Date(`${latestPriceDate}T00:00:00Z`);
    if (Number.isNaN(latestDate.getTime())) {
        return false;
    }

    const ageMs = Date.now() - latestDate.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return ageMs > sevenDaysMs;
}

export async function getMarketDataHistory(input: {
    isin: string;
    period?: HistoryPeriod;
    fromDate?: string;
    toDate?: string;
}): Promise<MarketDataResponse> {
    const normalizedIsin = normalizeLookupIsin(input.isin);
    const requestedPeriod = input.period ?? "MAX";

    try {
        const instrument = await getInstrumentByIsin(normalizedIsin);
        if (!instrument) {
            return {
                ok: false,
                status: "missing_instrument",
                message: "Für diese ISIN wurden keine Instrumenten-Stammdaten gefunden.",
                metadata: {
                    isin: normalizedIsin,
                    provider: null,
                    symbol: null,
                    exchange: null,
                    currency: null,
                    mappingStatus: "missing_instrument",
                    marketDataStatus: null,
                    marketDataStatusReason: null,
                    latestPriceDate: null,
                    pointCount: 0,
                    stale: false,
                },
            };
        }

        const marketDataStatus = instrument.marketDataStatus;
        const marketDataStatusReason = instrument.marketDataStatusReason;
        const statusAsMappingStatus =
            marketDataStatus === "excluded" ||
            marketDataStatus === "legacy" ||
            marketDataStatus === "derivative" ||
            marketDataStatus === "unknown";

        const primaryMapping = await getPrimarySymbolMappingByIsin(normalizedIsin);
        if (!primaryMapping) {
            return {
                ok: false,
                status: statusAsMappingStatus ? marketDataStatus : "missing_primary_mapping",
                message: statusAsMappingStatus
                    ? `Marktdatenstatus: ${marketDataStatus}.`
                    : "Für dieses Asset fehlt ein primäres Symbol-Mapping.",
                metadata: {
                    isin: normalizedIsin,
                    provider: null,
                    symbol: null,
                    exchange: null,
                    currency: instrument.currency ?? null,
                    mappingStatus: statusAsMappingStatus ? marketDataStatus : "missing_primary_mapping",
                    marketDataStatus,
                    marketDataStatusReason,
                    latestPriceDate: null,
                    pointCount: 0,
                    stale: false,
                },
            };
        }

        const latestPriceDate = await getLatestDailyPriceDateByIsin({
            isin: normalizedIsin,
            provider: primaryMapping.provider,
        });
        const periodFromDate = resolveFromDateForPeriod({
            requestedPeriod,
            latestPriceDate,
        });
        const fromDate = input.fromDate ?? periodFromDate ?? undefined;
        const toDate = input.toDate;

        const pointsRaw = await getDailyPricesByIsin({
            isin: normalizedIsin,
            provider: primaryMapping.provider,
            from: fromDate,
            to: toDate,
        });
        const downsampleResult = downsampleHistoryPoints(pointsRaw);
        const points = downsampleResult.points;

        if (points.length === 0) {
            return {
                ok: false,
                status: statusAsMappingStatus ? marketDataStatus : "primary_without_prices",
                message: statusAsMappingStatus
                    ? `Marktdatenstatus: ${marketDataStatus}.`
                    : "Für dieses Asset liegen keine historischen Kursdaten vor.",
                metadata: {
                    isin: normalizedIsin,
                    provider: primaryMapping.provider,
                    symbol: primaryMapping.symbol,
                    exchange: primaryMapping.exchange ?? null,
                    currency: primaryMapping.currency ?? instrument.currency ?? null,
                    mappingStatus: statusAsMappingStatus ? marketDataStatus : "primary_without_prices",
                    marketDataStatus,
                    marketDataStatusReason,
                    latestPriceDate: null,
                    pointCount: 0,
                    requestedPeriod,
                    fromDate: fromDate ?? null,
                    toDate: toDate ?? null,
                    pointCountRaw: downsampleResult.pointCountRaw,
                    pointCountReturned: downsampleResult.pointCountReturned,
                    downsampled: downsampleResult.downsampled,
                    stale: false,
                },
            };
        }

        const actions = await getMarketActionsByIsin({
            isin: normalizedIsin,
            provider: primaryMapping.provider,
            from: fromDate,
            to: toDate,
        });
        const latestPoint = points[points.length - 1];
        const latestResponsePriceDate = latestPoint.date;

        return {
            ok: true,
            status: "db_hit",
            message: "Kursdaten aus lokaler Kursdatenbank.",
            data: {
                provider: primaryMapping.provider === "yfinance" ? "yfinance" : "alphavantage",
                isin: normalizedIsin,
                symbol: primaryMapping.symbol,
                points: points.map((point) => ({
                    date: point.date,
                    open: point.open ?? undefined,
                    high: point.high ?? undefined,
                    low: point.low ?? undefined,
                    close: point.close,
                    volume: point.volume,
                    currency: point.currency,
                })),
                actions: actions
                    .filter((action) => action.actionType === "dividend" && action.amount != null && Number.isFinite(action.amount))
                    .map((action) => ({
                        actionType: "dividend",
                        date: action.date,
                        amount: Number(action.amount),
                        currency: action.currency,
                    })),
                refreshedAt: latestPoint.importedAt,
                source: "postgres",
            },
            metadata: {
                isin: normalizedIsin,
                provider: primaryMapping.provider,
                symbol: primaryMapping.symbol,
                exchange: primaryMapping.exchange ?? null,
                currency: primaryMapping.currency ?? instrument.currency ?? null,
                mappingStatus:
                    marketDataStatus === "excluded" ||
                    marketDataStatus === "legacy" ||
                    marketDataStatus === "derivative" ||
                    marketDataStatus === "unknown"
                        ? marketDataStatus
                        : "ok",
                marketDataStatus,
                marketDataStatusReason,
                latestPriceDate: latestResponsePriceDate,
                pointCount: downsampleResult.pointCountReturned,
                requestedPeriod,
                fromDate: fromDate ?? null,
                toDate: toDate ?? null,
                pointCountRaw: downsampleResult.pointCountRaw,
                pointCountReturned: downsampleResult.pointCountReturned,
                downsampled: downsampleResult.downsampled,
                stale: isStaleLatestDate(latestResponsePriceDate),
            },
            cache: {
                refreshedAt: latestPoint.importedAt,
                isFresh: !isStaleLatestDate(latestResponsePriceDate),
                ageHours: 0,
                provider: primaryMapping.provider === "yfinance" ? "yfinance" : "alphavantage",
                symbol: primaryMapping.symbol,
                pointCount: downsampleResult.pointCountReturned,
            },
            diagnostics: {
                provider: primaryMapping.provider === "yfinance" ? "yfinance" : "alphavantage",
                symbol: primaryMapping.symbol,
                providerStatusCategory: "ok",
                detectedResponseShape: "none",
                pointCount: downsampleResult.pointCountReturned,
            },
        };
    } catch (error) {
        if (error instanceof MarketDataRepositoryError && error.code === "invalid_input") {
            return {
                ok: false,
                status: "invalid_request",
                message: "Ungültige ISIN.",
                metadata: {
                    isin: normalizedIsin,
                    provider: null,
                    symbol: null,
                    exchange: null,
                    currency: null,
                    mappingStatus: "missing_instrument",
                    marketDataStatus: null,
                    marketDataStatusReason: null,
                    latestPriceDate: null,
                    pointCount: 0,
                    stale: false,
                },
            };
        }

        if (error instanceof MarketDataRepositoryError && error.code === "missing_db_config") {
            return {
                ok: false,
                status: "db_unavailable",
                message: "Kursdaten-Datenbank ist derzeit nicht verfügbar.",
                metadata: {
                    isin: normalizedIsin,
                    provider: null,
                    symbol: null,
                    exchange: null,
                    currency: null,
                    mappingStatus: "db_unavailable",
                    marketDataStatus: null,
                    marketDataStatusReason: null,
                    latestPriceDate: null,
                    pointCount: 0,
                    stale: false,
                },
            };
        }

        return {
            ok: false,
            status: "not_available",
            message: "Kursdaten konnten nicht geladen werden.",
            metadata: {
                isin: normalizedIsin,
                provider: null,
                symbol: null,
                exchange: null,
                currency: null,
                mappingStatus: "db_unavailable",
                marketDataStatus: null,
                marketDataStatusReason: null,
                latestPriceDate: null,
                pointCount: 0,
                stale: false,
            },
        };
    }
}
