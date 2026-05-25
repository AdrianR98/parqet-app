import "server-only";

import { listMarketDataRequests } from "./repository";
import type { MarketDataRequestStatus } from "./types-core";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const STATUS_VALUES = new Set<MarketDataRequestStatus>([
    "pending",
    "known_instrument",
    "mapping_missing",
    "import_ready",
    "imported",
    "failed",
    "ignored",
]);

export type AdminMarketDataRequestsPayload = {
    total: number;
    shown: number;
    limit: number;
    filters: {
        status: string | null;
        source: string | null;
        q: string | null;
    };
    items: Array<{
        isin: string;
        displayName: string | null;
        name: string | null;
        assetType: string | null;
        currency: string | null;
        wkn: string | null;
        status: string;
        source: string;
        firstSeenAt: string;
        lastSeenAt: string;
        seenCount: number;
        notes: string | null;
    }>;
};

export function sanitizeMarketDataRequestsLimit(rawLimit: string | null): number {
    if (!rawLimit) return DEFAULT_LIMIT;
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;
    return Math.min(parsed, MAX_LIMIT);
}

function sanitizeStatus(raw: string | null): MarketDataRequestStatus | null {
    if (!raw) return null;
    const normalized = raw.trim().toLowerCase() as MarketDataRequestStatus;
    return STATUS_VALUES.has(normalized) ? normalized : null;
}

function sanitizeText(raw: string | null): string | null {
    if (!raw) return null;
    const normalized = raw.trim();
    return normalized ? normalized : null;
}

export function sanitizeMarketDataRequestsFilters(input: {
    status?: string | null;
    source?: string | null;
    q?: string | null;
}): {
    status: MarketDataRequestStatus | null;
    source: string | null;
    q: string | null;
} {
    return {
        status: sanitizeStatus(input.status ?? null),
        source: sanitizeText(input.source ?? null)?.toLowerCase() ?? null,
        q: sanitizeText(input.q ?? null),
    };
}

export async function getAdminMarketDataRequests(input: {
    limit?: string | null;
    status?: string | null;
    source?: string | null;
    q?: string | null;
}): Promise<AdminMarketDataRequestsPayload> {
    const limit = sanitizeMarketDataRequestsLimit(input.limit ?? null);
    const filters = sanitizeMarketDataRequestsFilters(input);
    const result = await listMarketDataRequests({
        limit,
        status: filters.status,
        source: filters.source,
        q: filters.q,
    });

    return {
        total: result.total,
        shown: result.items.length,
        limit,
        filters,
        items: result.items.map((item) => ({
            isin: item.isin,
            displayName: item.displayName,
            name: item.name,
            assetType: item.assetType,
            currency: item.currency,
            wkn: item.wkn,
            status: item.status,
            source: item.source,
            firstSeenAt: item.firstSeenAt,
            lastSeenAt: item.lastSeenAt,
            seenCount: item.seenCount,
            notes: item.notes,
        })),
    };
}
