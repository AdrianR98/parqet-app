import "server-only";

import { listAdminMarketSymbolMappingsOverviewRows } from "./repository";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const BOOLEAN_VALUES = new Set(["true", "false"]);

export type AdminMappingsPayload = {
    total: number;
    shown: number;
    limit: number;
    filters: {
        q: string | null;
        provider: string | null;
        verified: boolean | null;
        primary: boolean | null;
        active: boolean | null;
        hasPrices: boolean | null;
    };
    items: Array<{
        id: string;
        isin: string;
        displayName: string | null;
        provider: string;
        symbol: string;
        exchange: string | null;
        currency: string | null;
        score: number | null;
        isPrimary: boolean;
        isActive: boolean;
        verifiedAt: string | null;
        source: string | null;
        statusReason: string | null;
        hasPriceData: boolean;
        latestPriceDate: string | null;
        latestClose: number | null;
    }>;
};

export function sanitizeMappingsLimit(rawLimit: string | null): number {
    if (!rawLimit) return DEFAULT_LIMIT;
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;
    return Math.min(parsed, MAX_LIMIT);
}

function sanitizeQuery(raw: string | null): string | null {
    if (!raw) return null;
    const normalized = raw.trim();
    return normalized ? normalized : null;
}

function sanitizeProvider(raw: string | null): string | null {
    if (!raw) return null;
    const normalized = raw.trim().toLowerCase();
    return normalized ? normalized : null;
}

function sanitizeBoolean(raw: string | null): boolean | null {
    if (!raw) return null;
    const normalized = raw.trim().toLowerCase();
    if (!BOOLEAN_VALUES.has(normalized)) return null;
    return normalized === "true";
}

export function sanitizeMappingsFilters(input: {
    q?: string | null;
    provider?: string | null;
    verified?: string | null;
    primary?: string | null;
    active?: string | null;
    hasPrices?: string | null;
}) {
    return {
        q: sanitizeQuery(input.q ?? null),
        provider: sanitizeProvider(input.provider ?? null),
        verified: sanitizeBoolean(input.verified ?? null),
        primary: sanitizeBoolean(input.primary ?? null),
        active: sanitizeBoolean(input.active ?? null),
        hasPrices: sanitizeBoolean(input.hasPrices ?? null),
    };
}

function extractSource(notes: string | null): string | null {
    if (!notes) return null;
    const match = notes.match(/source=([^|;]+)/i);
    return match?.[1]?.trim() ?? null;
}

function extractScore(notes: string | null): number | null {
    if (!notes) return null;
    const match = notes.match(/score[:=]\s*(-?\d+(?:\.\d+)?)/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

export async function getAdminMarketSymbolMappings(input: {
    limit?: string | null;
    q?: string | null;
    provider?: string | null;
    verified?: string | null;
    primary?: string | null;
    active?: string | null;
    hasPrices?: string | null;
}): Promise<AdminMappingsPayload> {
    const limit = sanitizeMappingsLimit(input.limit ?? null);
    const filters = sanitizeMappingsFilters(input);
    const rows = await listAdminMarketSymbolMappingsOverviewRows();

    const filtered = rows.filter((row) => {
        if (filters.provider && row.provider.toLowerCase() !== filters.provider) return false;
        if (filters.verified !== null && (row.verifiedAt !== null) !== filters.verified) return false;
        if (filters.primary !== null && row.isPrimary !== filters.primary) return false;
        if (filters.active !== null && row.isActive !== filters.active) return false;
        if (filters.hasPrices !== null && row.hasPriceData !== filters.hasPrices) return false;
        if (filters.q) {
            const q = filters.q.toLowerCase();
            const haystack = [row.isin, row.displayName ?? "", row.symbol, row.exchange ?? "", row.provider].join(" ").toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });

    const items = filtered.slice(0, limit).map((row) => ({
        id: row.id,
        isin: row.isin,
        displayName: row.displayName,
        provider: row.provider,
        symbol: row.symbol,
        exchange: row.exchange,
        currency: row.currency,
        score: extractScore(row.notes),
        isPrimary: row.isPrimary,
        isActive: row.isActive,
        verifiedAt: row.verifiedAt,
        source: extractSource(row.notes),
        statusReason: row.notes,
        hasPriceData: row.hasPriceData,
        latestPriceDate: row.latestPriceDate,
        latestClose: row.latestClose,
    }));

    return {
        total: filtered.length,
        shown: items.length,
        limit,
        filters,
        items,
    };
}
