// ============================================================
// src/lib/asset-metadata.ts
// ------------------------------------------------------------
// Clientseitiges Metadata-System fuer Dashboard und Cache.
//
// Ziel:
// - CSV-generierte Namen direkt in der UI verfuegbar machen
// - lokale Browser-Ergaenzungen weiter erlauben
// - Prioritaet fuer Anzeigenamen:
//   CSV -> Activity/Asset -> sonstige Fallbacks
// ============================================================

import type { AssetMetadata, AssetSummary } from "./types";
import { CSV_ASSET_METADATA } from "./generated/csv-asset-metadata";

const METADATA_STORAGE_KEY = "parqet-asset-metadata-cache-v1";

// ============================================================
// Lokaler manueller Seed
// ------------------------------------------------------------
// Fuer gezielte Sonderfaelle, falls spaeter benoetigt.
// ============================================================

const LOCAL_METADATA_SEED: Record<string, AssetMetadata> = {
    // Beispiel:
    // "US5949181045": {
    //     name: "Microsoft Corp.",
    //     symbol: "MSFT",
    //     wkn: "870747",
    // },
};

// ============================================================
// Typen
// ============================================================

type AssetMetadataCache = Record<string, AssetMetadata>;

// ============================================================
// Helper
// ============================================================

function isBrowser(): boolean {
    return typeof window !== "undefined";
}

function sanitizeString(value: unknown): string | null {
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

function sanitizeNumber(value: unknown): number | null {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return null;
    }

    return value;
}

function normalizeIsin(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toUpperCase();

    if (!normalized) {
        return null;
    }

    return normalized;
}

function normalizeMetadata(input: Partial<AssetMetadata> | null | undefined): AssetMetadata {
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

function getStaticMetadata(): AssetMetadataCache {
    return {
        ...LOCAL_METADATA_SEED,
        ...CSV_ASSET_METADATA,
    };
}

// ============================================================
// localStorage Cache
// ============================================================

export function loadAssetMetadataCache(): AssetMetadataCache {
    if (!isBrowser()) {
        return {};
    }

    try {
        const raw = window.localStorage.getItem(METADATA_STORAGE_KEY);

        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw) as Record<string, Partial<AssetMetadata>>;

        return Object.fromEntries(
            Object.entries(parsed).map(([isin, metadata]) => [
                isin,
                normalizeMetadata(metadata),
            ])
        );
    } catch {
        return {};
    }
}

export function saveAssetMetadataCache(cache: AssetMetadataCache): void {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(cache));
    } catch {
        // localStorage-Fehler bewusst still behandeln
    }
}

export function getMergedAssetMetadataCache(): AssetMetadataCache {
    const browserCache = loadAssetMetadataCache();

    return {
        ...getStaticMetadata(),
        ...browserCache,
    };
}

export function upsertAssetMetadata(
    isin: string,
    incoming: Partial<AssetMetadata>
): AssetMetadataCache {
    const normalizedIsin = normalizeIsin(isin);

    if (!normalizedIsin) {
        return getMergedAssetMetadataCache();
    }

    const currentCache = getMergedAssetMetadataCache();
    const normalizedIncoming = normalizeMetadata(incoming);
    const current = currentCache[normalizedIsin] ?? {};

    const next: AssetMetadata = {
        name: normalizedIncoming.name ?? current.name ?? null,
        assetName: normalizedIncoming.assetName ?? current.assetName ?? null,
        displayName: normalizedIncoming.displayName ?? current.displayName ?? null,
        title: normalizedIncoming.title ?? current.title ?? null,

        symbol: normalizedIncoming.symbol ?? current.symbol ?? null,
        ticker: normalizedIncoming.ticker ?? current.ticker ?? null,
        tickerSymbol: normalizedIncoming.tickerSymbol ?? current.tickerSymbol ?? null,

        wkn: normalizedIncoming.wkn ?? current.wkn ?? null,

        marketPrice: normalizedIncoming.marketPrice ?? current.marketPrice ?? null,
        marketPriceAt: normalizedIncoming.marketPriceAt ?? current.marketPriceAt ?? null,
        marketPriceSource:
            normalizedIncoming.marketPriceSource ?? current.marketPriceSource ?? null,

        currency: normalizedIncoming.currency ?? current.currency ?? null,
        assetType: normalizedIncoming.assetType ?? current.assetType ?? null,
        exchange: normalizedIncoming.exchange ?? current.exchange ?? null,
    };

    const nextCache = {
        ...currentCache,
        [normalizedIsin]: next,
    };

    saveAssetMetadataCache(nextCache);

    return nextCache;
}

// ============================================================
// Analyse: fehlende Metadaten
// ============================================================

export function getMissingMetadataIsins(assets: AssetSummary[]): string[] {
    const cache = getMergedAssetMetadataCache();

    return assets
        .map((asset) => asset.isin)
        .filter((isin) => {
            const normalizedIsin = normalizeIsin(isin);

            if (!normalizedIsin) {
                return false;
            }

            const meta = cache[normalizedIsin];

            return !meta || (!meta.name && !meta.symbol && !meta.wkn);
        });
}

// ============================================================
// UI-Enrichment
// ------------------------------------------------------------
// WICHTIG:
// Fuer den Anzeigenamen gilt bewusst:
//
//   CSV -> bereits vorhandener Asset-/Activity-Name -> Fallback
//
// Damit wird die CSV zur primaeren Namensquelle.
// ============================================================

export function enrichAssetsWithMetadata(assets: AssetSummary[]): AssetSummary[] {
    const mergedCache = getMergedAssetMetadataCache();

    return assets.map((asset) => {
        const normalizedIsin = normalizeIsin(asset.isin);
        const csvMetadata = normalizedIsin ? CSV_ASSET_METADATA[normalizedIsin] : undefined;
        const cachedMetadata = normalizedIsin ? mergedCache[normalizedIsin] : undefined;

        const resolvedName =
            csvMetadata?.name ??
            asset.name ??
            asset.assetName ??
            asset.displayName ??
            asset.title ??
            cachedMetadata?.name ??
            asset.symbol ??
            asset.ticker ??
            asset.tickerSymbol ??
            asset.wkn ??
            asset.isin;

        return {
            ...asset,

            name: resolvedName ?? null,
            assetName: asset.assetName ?? csvMetadata?.name ?? cachedMetadata?.assetName ?? null,
            displayName:
                asset.displayName ?? csvMetadata?.name ?? cachedMetadata?.displayName ?? null,
            title: asset.title ?? csvMetadata?.name ?? cachedMetadata?.title ?? null,

            symbol:
                asset.symbol ??
                cachedMetadata?.symbol ??
                cachedMetadata?.ticker ??
                null,

            ticker: asset.ticker ?? cachedMetadata?.ticker ?? null,
            tickerSymbol: asset.tickerSymbol ?? cachedMetadata?.tickerSymbol ?? null,

            wkn: asset.wkn ?? cachedMetadata?.wkn ?? null,

            marketPrice: asset.marketPrice ?? cachedMetadata?.marketPrice ?? null,
            marketPriceAt: asset.marketPriceAt ?? cachedMetadata?.marketPriceAt ?? null,
            marketPriceSource:
                asset.marketPriceSource ?? cachedMetadata?.marketPriceSource ?? null,

            externalMetadata: {
                ...(asset.externalMetadata ?? {}),
                ...(cachedMetadata ?? {}),
                csvName: csvMetadata?.name ?? null,
            },
        };
    });
}