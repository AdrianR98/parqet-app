import "server-only";

import { listAdminMarketDataRunOverviewRows } from "./repository";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function truncateSafeErrorMessage(message: string | null): string | null {
    if (!message) return null;
    const oneLine = message.replace(/\s+/g, " ").trim();
    if (!oneLine) return null;
    const withoutDbUrl = oneLine.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
    return withoutDbUrl.length > 200 ? `${withoutDbUrl.slice(0, 200)}...` : withoutDbUrl;
}

function sanitizeTextFilter(raw: string | null): string | null {
    if (!raw) return null;
    const normalized = raw.trim().toLowerCase();
    return normalized ? normalized : null;
}

export function sanitizeRunsLimit(rawLimit: string | null): number {
    if (!rawLimit) return DEFAULT_LIMIT;
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;
    return Math.min(parsed, MAX_LIMIT);
}

export function sanitizeRunsFilters(input: {
    status?: string | null;
    runType?: string | null;
    provider?: string | null;
}) {
    return {
        status: sanitizeTextFilter(input.status ?? null),
        runType: sanitizeTextFilter(input.runType ?? null),
        provider: sanitizeTextFilter(input.provider ?? null),
    };
}

export type AdminRunsPayload = {
    total: number;
    shown: number;
    limit: number;
    filters: {
        status: string | null;
        runType: string | null;
        provider: string | null;
    };
    items: Array<{
        id: string;
        runType: string;
        status: string;
        provider: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        durationMs: number | null;
        requestedBy: string | null;
        totalItems: number;
        succeededItems: number;
        failedItems: number;
        skippedItems: number;
        errorCount: number;
        latestErrorMessage: string | null;
    }>;
};

export async function getAdminMarketDataRuns(input: {
    limit?: string | null;
    status?: string | null;
    runType?: string | null;
    provider?: string | null;
}): Promise<AdminRunsPayload> {
    const limit = sanitizeRunsLimit(input.limit ?? null);
    const filters = sanitizeRunsFilters(input);
    const rows = await listAdminMarketDataRunOverviewRows();

    const filtered = rows.filter((row) => {
        if (filters.status && row.status.toLowerCase() !== filters.status) return false;
        if (filters.runType && row.runType.toLowerCase() !== filters.runType) return false;
        if (filters.provider && String(row.provider ?? "").toLowerCase() !== filters.provider) return false;
        return true;
    });

    const items = filtered.slice(0, limit).map((row) => ({
        id: row.id,
        runType: row.runType,
        status: row.status,
        provider: row.provider,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        durationMs: row.durationMs,
        requestedBy: null,
        totalItems: row.totalItems,
        succeededItems: row.succeededItems,
        failedItems: row.failedItems,
        skippedItems: row.skippedItems,
        errorCount: row.errorCount,
        latestErrorMessage: truncateSafeErrorMessage(row.latestErrorMessage),
    }));

    return {
        total: filtered.length,
        shown: items.length,
        limit,
        filters,
        items,
    };
}
