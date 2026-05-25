import "server-only";

import { listAdminOpenUnmappedMarketDataRows } from "./repository";
import type { MarketDataInstrumentStatus } from "./types-core";
import { classifyUnmappedTriage, type MappingStatus } from "./unmapped-triage";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const ACTION_VALUES = new Set([
    "inspect_instrument",
    "add_candidates",
    "validate_candidates",
    "import_manual_mapping",
    "review_derivative_or_exclude",
    "review_legacy_or_successor",
    "review_failed_validation",
    "backfill_primary",
    "ready",
]);
const CATEGORY_VALUES = new Set([
    "failed_or_excluded",
    "mapping_candidate_needed",
    "derivative_or_warrant",
    "legacy_or_corporate_action",
    "no_mapping",
    "manual_review",
    "unverified_mapping",
    "ready",
]);
const STATUS_VALUES = new Set(["active", "excluded", "legacy", "derivative", "unknown"]);

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
    triageHint: string | null;
    triageReason: string | null;
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
            const classification = classifyUnmappedTriage(row);

            return {
                priority: classification.priority,
                isin: row.isin,
                displayName: row.displayName,
                assetType: row.assetType,
                currency: row.currency,
                wkn: row.wkn,
                marketDataStatus: row.marketDataStatus,
                mappingStatus: classification.mappingStatus as MappingStatus,
                primarySymbol: row.primarySymbol,
                candidateSymbols: row.candidateSymbols,
                category: classification.category,
                suggestedAction: classification.suggestedAction,
                statusReason: row.marketDataStatusReason,
                triageHint: classification.triageHint,
                triageReason: classification.triageReason,
                hasPriceData: row.hasPriceData,
                hasMarketActions: row.hasMarketActions,
            };
        })
        .filter((row) => row.mappingStatus !== "ready")
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
