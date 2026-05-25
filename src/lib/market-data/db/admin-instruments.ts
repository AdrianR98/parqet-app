import "server-only";

import { listAdminMarketInstrumentOverviewRows } from "./repository";
import type { MarketDataInstrumentStatus } from "./types-core";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const STATUS_VALUES = new Set(["active", "excluded", "legacy", "derivative", "unknown"]);
const BOOLEAN_VALUES = new Set(["true", "false"]);

export type AdminInstrumentsItem = {
    isin: string;
    displayName: string | null;
    name: string | null;
    assetType: string | null;
    currency: string | null;
    wkn: string | null;
    metadataStatus: string | null;
    marketDataStatus: string | null;
    marketDataStatusReason: string | null;
    primarySymbol: string | null;
    primaryExchange: string | null;
    primaryCurrency: string | null;
    verifiedMappingCount: number;
    candidateMappingCount: number;
    hasPriceData: boolean;
    hasMarketActions: boolean;
    firstPriceDate: string | null;
    lastPriceDate: string | null;
    latestClose: number | null;
};

export type AdminInstrumentsPayload = {
    total: number;
    shown: number;
    limit: number;
    filters: {
        q: string | null;
        status: string | null;
        assetType: string | null;
        hasPrimary: boolean | null;
        hasPrices: boolean | null;
    };
    items: AdminInstrumentsItem[];
};

export function sanitizeInstrumentsLimit(rawLimit: string | null): number {
    if (!rawLimit) return DEFAULT_LIMIT;

    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;

    return Math.min(parsed, MAX_LIMIT);
}

function sanitizeStatus(raw: string | null): MarketDataInstrumentStatus | null {
    if (!raw) return null;
    const normalized = raw.trim().toLowerCase();
    if (!STATUS_VALUES.has(normalized)) return null;
    return normalized as MarketDataInstrumentStatus;
}

function sanitizeBoolean(raw: string | null): boolean | null {
    if (!raw) return null;
    const normalized = raw.trim().toLowerCase();
    if (!BOOLEAN_VALUES.has(normalized)) return null;
    return normalized === "true";
}

function sanitizeQuery(raw: string | null): string | null {
    if (!raw) return null;
    const normalized = raw.trim();
    return normalized ? normalized : null;
}

function sanitizeAssetType(raw: string | null): string | null {
    if (!raw) return null;
    const normalized = raw.trim().toLowerCase();
    return normalized ? normalized : null;
}

export function sanitizeInstrumentsFilters(input: {
    q?: string | null;
    status?: string | null;
    assetType?: string | null;
    hasPrimary?: string | null;
    hasPrices?: string | null;
}): {
    q: string | null;
    status: MarketDataInstrumentStatus | null;
    assetType: string | null;
    hasPrimary: boolean | null;
    hasPrices: boolean | null;
} {
    return {
        q: sanitizeQuery(input.q ?? null),
        status: sanitizeStatus(input.status ?? null),
        assetType: sanitizeAssetType(input.assetType ?? null),
        hasPrimary: sanitizeBoolean(input.hasPrimary ?? null),
        hasPrices: sanitizeBoolean(input.hasPrices ?? null),
    };
}

export async function getAdminMarketInstruments(input: {
    limit?: string | null;
    q?: string | null;
    status?: string | null;
    assetType?: string | null;
    hasPrimary?: string | null;
    hasPrices?: string | null;
}): Promise<AdminInstrumentsPayload> {
    const limit = sanitizeInstrumentsLimit(input.limit ?? null);
    const filters = sanitizeInstrumentsFilters(input);
    const rows = await listAdminMarketInstrumentOverviewRows();

    const filtered = rows.filter((row) => {
        if (filters.status && row.marketDataStatus !== filters.status) return false;
        if (filters.assetType && String(row.assetType ?? "").toLowerCase() !== filters.assetType) return false;
        if (filters.hasPrimary !== null && row.hasPrimaryMapping !== filters.hasPrimary) return false;
        if (filters.hasPrices !== null && row.hasPriceData !== filters.hasPrices) return false;

        if (filters.q) {
            const q = filters.q.toLowerCase();
            const haystack = [row.isin, row.displayName ?? "", row.name ?? "", row.wkn ?? "", row.primarySymbol ?? ""]
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(q)) return false;
        }

        return true;
    });

    const items = filtered.slice(0, limit).map((row): AdminInstrumentsItem => ({
        isin: row.isin,
        displayName: row.displayName,
        name: row.name,
        assetType: row.assetType,
        currency: row.currency,
        wkn: row.wkn,
        metadataStatus: row.metadataSource,
        marketDataStatus: row.marketDataStatus,
        marketDataStatusReason: row.marketDataStatusReason,
        primarySymbol: row.primarySymbol,
        primaryExchange: row.primaryExchange,
        primaryCurrency: row.primaryCurrency,
        verifiedMappingCount: row.verifiedMappingCount,
        candidateMappingCount: row.candidateMappingCount,
        hasPriceData: row.hasPriceData,
        hasMarketActions: row.hasMarketActions,
        firstPriceDate: row.firstPriceDate,
        lastPriceDate: row.lastPriceDate,
        latestClose: row.latestClose,
    }));

    return {
        total: filtered.length,
        shown: items.length,
        limit,
        filters: {
            q: filters.q,
            status: filters.status,
            assetType: filters.assetType,
            hasPrimary: filters.hasPrimary,
            hasPrices: filters.hasPrices,
        },
        items,
    };
}
