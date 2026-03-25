// ============================================================
// src/lib/metadata-utils.ts
// ------------------------------------------------------------
// Gemeinsame Helper fuer Metadata-Normalisierung,
// Priorisierung und Source-Kennzeichnung.
// ============================================================

import type { AssetMetadata } from "./types";

// ============================================================
// Metadata Source
// ------------------------------------------------------------
// Diese Kennzeichnung hilft spaeter im Audit/Fix-View
// und bei Debugging / Nachvollziehbarkeit.
// ============================================================

export type AssetMetadataSource =
    | "csv"
    | "local_seed"
    | "activity"
    | "cache"
    | "fallback"
    | "unknown";

// ============================================================
// String / Number Sanitizer
// ============================================================

export function sanitizeString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();

    if (!normalized) {
        return null;
    }

    const lowered = normalized.toLowerCase();

    if (lowered === "undefined" || lowered === "null" || lowered === "n/a") {
        return null;
    }

    return normalized;
}

export function sanitizeNumber(value: unknown): number | null {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return null;
    }

    return value;
}

// ============================================================
// Identifier Helper
// ============================================================

export function normalizeIsin(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toUpperCase();

    if (!normalized) {
        return null;
    }

    return normalized;
}

export function isValidIsin(value: string | null | undefined): boolean {
    const normalized = normalizeIsin(value);

    if (!normalized) {
        return false;
    }

    return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalized);
}

// ============================================================
// Metadata Normalization
// ============================================================

export function normalizeMetadata(
    input: Partial<AssetMetadata> | null | undefined
): AssetMetadata {
    return {
        name: sanitizeString(input?.name),
        assetName: sanitizeString(input?.assetName),
        displayName: sanitizeString(input?.displayName),
        title: sanitizeString(input?.title),

        symbol: sanitizeString(input?.symbol),
        ticker: sanitizeString(input?.ticker),
        tickerSymbol: sanitizeString(input?.tickerSymbol),

        wkn: sanitizeString(input?.wkn),

        marketPrice: sanitizeNumber(input?.marketPrice),
        marketPriceAt: sanitizeString(input?.marketPriceAt),
        marketPriceSource: sanitizeString(input?.marketPriceSource),

        currency: sanitizeString(input?.currency),
        assetType: sanitizeString(input?.assetType),
        exchange: sanitizeString(input?.exchange),
    };
}

// ============================================================
// Name Resolution
// ------------------------------------------------------------
// Einheitliche Namensprioritaet fuer UI / API:
// 1) csv
// 2) local seed
// 3) activity / asset existing name
// 4) cache
// 5) fallback fields
// ============================================================

export function resolvePreferredAssetName(params: {
    csvName?: string | null;
    localSeedName?: string | null;
    activityName?: string | null;
    cachedName?: string | null;
    symbol?: string | null;
    ticker?: string | null;
    tickerSymbol?: string | null;
    wkn?: string | null;
    isin?: string | null;
}): { name: string | null; source: AssetMetadataSource } {
    if (params.csvName) {
        return { name: params.csvName, source: "csv" };
    }

    if (params.localSeedName) {
        return { name: params.localSeedName, source: "local_seed" };
    }

    if (params.activityName) {
        return { name: params.activityName, source: "activity" };
    }

    if (params.cachedName) {
        return { name: params.cachedName, source: "cache" };
    }

    if (params.symbol) {
        return { name: params.symbol, source: "fallback" };
    }

    if (params.ticker) {
        return { name: params.ticker, source: "fallback" };
    }

    if (params.tickerSymbol) {
        return { name: params.tickerSymbol, source: "fallback" };
    }

    if (params.wkn) {
        return { name: params.wkn, source: "fallback" };
    }

    if (params.isin) {
        return { name: params.isin, source: "fallback" };
    }

    return { name: null, source: "unknown" };
}