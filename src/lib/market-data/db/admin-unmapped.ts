import "server-only";

import { listAdminOpenUnmappedMarketDataRows } from "./repository";
import type { MarketDataInstrumentStatus } from "./types-core";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const ACTION_VALUES = new Set([
    "inspect_instrument",
    "manual_mapping_required",
    "validate_existing_candidate",
    "search_home_market_symbol",
    "exclude_or_archive",
]);
const CATEGORY_VALUES = new Set([
    "failed_or_excluded",
    "missing_primary_mapping",
    "primary_without_prices",
    "mapping_unverified",
    "manual_review",
]);
const STATUS_VALUES = new Set(["active", "excluded", "legacy", "derivative", "unknown"]);

type MappingStatus = "failed_validation" | "no_mapping" | "primary_without_prices" | "unverified_mapping";

type AdminUnmappedFilters = {
    category: string | null;
    action: string | null;
    status: MarketDataInstrumentStatus | null;
};

export type AdminUnmappedItem = {
    priority: number;
    isin: string;
    displayName: string | null;
    assetType: string | null;
    currency: string | null;
    wkn: string | null;
    marketDataStatus: MarketDataInstrumentStatus | null;
    mappingStatus: MappingStatus;
    primarySymbol: string | null;
    candidateSymbols: string[];
    category: string;
    suggestedAction: string;
    statusReason: string | null;
    hasPriceData: boolean;
    hasMarketActions: boolean;
};

export type AdminUnmappedPayload = {
    totalOpen: number;
    shown: number;
    limit: number;
    filters: {
        category: string | null;
        action: string | null;
        status: string | null;
    };
    items: AdminUnmappedItem[];
};

export function sanitizeUnmappedLimit(rawLimit: string | null): number {
    if (!rawLimit) return DEFAULT_LIMIT;

    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return DEFAULT_LIMIT;
    }

    return Math.min(parsed, MAX_LIMIT);
}

function sanitizeFilter(raw: string | null, values: Set<string>): string | null {
    if (!raw) return null;

    const normalized = raw.trim().toLowerCase();
    if (!normalized || !values.has(normalized)) {
        return null;
    }

    return normalized;
}

export function sanitizeUnmappedFilters(input: {
    category?: string | null;
    action?: string | null;
    status?: string | null;
}): AdminUnmappedFilters {
    const category = sanitizeFilter(input.category ?? null, CATEGORY_VALUES);
    const action = sanitizeFilter(input.action ?? null, ACTION_VALUES);
    const status = sanitizeFilter(input.status ?? null, STATUS_VALUES) as MarketDataInstrumentStatus | null;

    return { category, action, status };
}

function classifyMappingStatus(row: {
    hasFailedValidation: boolean;
    hasAnyMapping: boolean;
    hasPrimaryMapping: boolean;
    hasVerifiedMapping: boolean;
    hasPriceData: boolean;
}): MappingStatus {
    if (row.hasFailedValidation) return "failed_validation";
    if (!row.hasAnyMapping || !row.hasPrimaryMapping) return "no_mapping";
    if (!row.hasPriceData) return "primary_without_prices";
    if (!row.hasVerifiedMapping) return "unverified_mapping";
    return "unverified_mapping";
}

function classifyCategory(row: {
    mappingStatus: MappingStatus;
    marketDataStatus: MarketDataInstrumentStatus | null;
}): { category: string; suggestedAction: string } {
    if (row.marketDataStatus && row.marketDataStatus !== "active") {
        return { category: "failed_or_excluded", suggestedAction: "inspect_instrument" };
    }

    if (row.mappingStatus === "failed_validation") {
        return { category: "failed_or_excluded", suggestedAction: "inspect_instrument" };
    }

    if (row.mappingStatus === "no_mapping") {
        return { category: "missing_primary_mapping", suggestedAction: "manual_mapping_required" };
    }

    if (row.mappingStatus === "primary_without_prices") {
        return { category: "primary_without_prices", suggestedAction: "validate_existing_candidate" };
    }

    return { category: "mapping_unverified", suggestedAction: "validate_existing_candidate" };
}

function computePriority(row: {
    mappingStatus: MappingStatus;
    marketDataStatus: MarketDataInstrumentStatus | null;
    hasPriceData: boolean;
    candidateSymbols: string[];
}): number {
    let priority = 10;

    if (row.mappingStatus === "failed_validation") priority += 50;
    if (row.mappingStatus === "no_mapping") priority += 40;
    if (row.mappingStatus === "primary_without_prices") priority += 35;
    if (row.mappingStatus === "unverified_mapping") priority += 25;
    if (row.marketDataStatus && row.marketDataStatus !== "active") priority += 15;
    if (!row.hasPriceData) priority += 10;
    if (row.candidateSymbols.length === 0) priority += 5;

    return priority;
}

export async function getAdminUnmappedMarketData(input: {
    limit?: string | null;
    category?: string | null;
    action?: string | null;
    status?: string | null;
}): Promise<AdminUnmappedPayload> {
    const limit = sanitizeUnmappedLimit(input.limit ?? null);
    const filters = sanitizeUnmappedFilters(input);
    const rows = await listAdminOpenUnmappedMarketDataRows();

    const mapped = rows
        .map((row): AdminUnmappedItem => {
            const mappingStatus = classifyMappingStatus(row);
            const classification = classifyCategory({
                mappingStatus,
                marketDataStatus: row.marketDataStatus,
            });

            return {
                priority: computePriority({
                    mappingStatus,
                    marketDataStatus: row.marketDataStatus,
                    hasPriceData: row.hasPriceData,
                    candidateSymbols: row.candidateSymbols,
                }),
                isin: row.isin,
                displayName: row.displayName,
                assetType: row.assetType,
                currency: row.currency,
                wkn: row.wkn,
                marketDataStatus: row.marketDataStatus,
                mappingStatus,
                primarySymbol: row.primarySymbol,
                candidateSymbols: row.candidateSymbols,
                category: classification.category,
                suggestedAction: classification.suggestedAction,
                statusReason: row.marketDataStatusReason,
                hasPriceData: row.hasPriceData,
                hasMarketActions: row.hasMarketActions,
            };
        })
        .sort((a, b) => b.priority - a.priority || a.isin.localeCompare(b.isin));

    const filtered = mapped.filter((item) => {
        if (filters.status && item.marketDataStatus !== filters.status) return false;
        if (filters.category && item.category !== filters.category) return false;
        if (filters.action && item.suggestedAction !== filters.action) return false;
        return true;
    });

    const items = filtered.slice(0, limit);

    return {
        totalOpen: filtered.length,
        shown: items.length,
        limit,
        filters: {
            category: filters.category,
            action: filters.action,
            status: filters.status,
        },
        items,
    };
}
