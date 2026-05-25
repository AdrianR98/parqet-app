import "server-only";

import {
    getMarketDataStatusSummary,
    listMarketInstrumentStatusSummary,
    listReferenceSourceCounts,
} from "./repository";

export type AdminMarketDataStatusPayload = {
    instrumentsTotal: number;
    mappingsTotal: number;
    yfinanceMappingsTotal: number;
    verifiedYfinanceMappings: number;
    primaryYfinanceMappings: number;
    instrumentsWithVerifiedYfinanceMapping: number;
    instrumentsWithoutAnyMapping: number;
    instrumentsWithMappingButNoVerifiedMapping: number;
    instrumentsWithoutPrimaryMapping: number;
    instrumentsWithDailyPriceData: number;
    instrumentsWithMarketActions: number;
    instrumentsWithPrimaryMappingButNoPriceData: number;
    failedValidationCandidates: number;
    marketDataStatusCounts: Record<string, number>;
    referenceSourceCounts: Array<{ sourceKey: string; rowCount: number }>;
};

export async function getAdminMarketDataStatus(): Promise<AdminMarketDataStatusPayload> {
    const [summary, statusRows, sourceCounts] = await Promise.all([
        getMarketDataStatusSummary(),
        listMarketInstrumentStatusSummary(),
        listReferenceSourceCounts(),
    ]);

    const marketDataStatusCounts: Record<string, number> = {};
    for (const row of statusRows) {
        const key = row.status ?? "unset";
        marketDataStatusCounts[key] = row.count;
    }

    return {
        instrumentsTotal: summary.instrumentsTotal,
        mappingsTotal: summary.mappingsTotal,
        yfinanceMappingsTotal: summary.yfinanceMappingsTotal,
        verifiedYfinanceMappings: summary.verifiedYfinanceMappings,
        primaryYfinanceMappings: summary.primaryYfinanceMappings,
        instrumentsWithVerifiedYfinanceMapping: summary.instrumentsWithVerifiedYfinance,
        instrumentsWithoutAnyMapping: summary.instrumentsWithoutAnyMapping,
        instrumentsWithMappingButNoVerifiedMapping: summary.instrumentsWithMappingButNoVerifiedYfinance,
        instrumentsWithoutPrimaryMapping: summary.instrumentsWithoutPrimaryYfinance,
        instrumentsWithDailyPriceData: summary.instrumentsWithDailyPrices,
        instrumentsWithMarketActions: summary.instrumentsWithActions,
        instrumentsWithPrimaryMappingButNoPriceData: summary.instrumentsWithPrimaryButNoPrices,
        failedValidationCandidates: summary.failedValidationCandidates,
        marketDataStatusCounts,
        referenceSourceCounts: sourceCounts,
    };
}
