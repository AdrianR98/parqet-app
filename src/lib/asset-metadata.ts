// ============================================================
// src/lib/asset-metadata.ts
// ------------------------------------------------------------
// Clientseitiges Metadata-System fuer Dashboard und Cache.
//
// Ziel:
// - CSV-generierte Namen direkt in der UI verfuegbar machen
// - lokale Browser-Ergaenzungen weiter erlauben
// - nachvollziehbare metadataSource pro Asset
// ============================================================

import type { AssetMetadata, AssetSummary } from "./types";
import { CSV_ASSET_METADATA } from "./generated/csv-asset-metadata";
import {
    normalizeIsin,
    normalizeMetadata,
    resolvePreferredAssetName,
} from "./metadata-utils";

const METADATA_STORAGE_KEY = "parqet-asset-metadata-cache-v1";

// ============================================================
// Lokaler manueller Seed
// ============================================================

const LOCAL_METADATA_SEED: Record<string, AssetMetadata> = {
    // Beispiel:
    // "US5949181045": {
    //     name: "Microsoft Corp.",
    //     symbol: "MSFT",
    //     wkn: "870747",
    // },
};

type AssetMetadataCache = Record<string, AssetMetadata>;

function isBrowser(): boolean {
    return typeof window !== "undefined";
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
    const normalized = normalizeIsin(isin);

    if (!normalized) {
        return getMergedAssetMetadataCache();
    }

    const currentCache = getMergedAssetMetadataCache();
    const normalizedIncoming = normalizeMetadata(incoming);
    const current = currentCache[normalized] ?? {};

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
        marketPriceSource: normalizedIncoming.marketPriceSource ?? current.marketPriceSource ?? null,

        currency: normalizedIncoming.currency ?? current.currency ?? null,
        assetType: normalizedIncoming.assetType ?? current.assetType ?? null,
        exchange: normalizedIncoming.exchange ?? current.exchange ?? null,
    };

    const nextCache = {
        ...currentCache,
        [normalized]: next,
    };

    saveAssetMetadataCache(nextCache);

    return nextCache;
}

export function getMissingMetadataIsins(assets: AssetSummary[]): string[] {
    const cache = getMergedAssetMetadataCache();

    return assets
        .map((asset) => asset.isin)
        .filter((isin) => {
            const normalized = normalizeIsin(isin);

            if (!normalized) {
                return false;
            }

            const meta = cache[normalized];
            return !meta || (!meta.name && !meta.symbol && !meta.wkn);
        });
}

// ============================================================
// UI-Enrichment
// ============================================================

export function enrichAssetsWithMetadata(assets: AssetSummary[]): AssetSummary[] {
    const mergedCache = getMergedAssetMetadataCache();

    return assets.map((asset) => {
        const normalized = normalizeIsin(asset.isin);

        const csvMetadata = normalized ? CSV_ASSET_METADATA[normalized] : undefined;
        const localSeedMetadata = normalized ? LOCAL_METADATA_SEED[normalized] : undefined;
        const cachedMetadata = normalized ? mergedCache[normalized] : undefined;

        const resolved = resolvePreferredAssetName({
            csvName: csvMetadata?.name ?? null,
            localSeedName: localSeedMetadata?.name ?? null,
            activityName:
                asset.name ??
                asset.assetName ??
                asset.displayName ??
                asset.title ??
                null,
            cachedName: cachedMetadata?.name ?? null,
            symbol: asset.symbol ?? cachedMetadata?.symbol ?? null,
            ticker: asset.ticker ?? cachedMetadata?.ticker ?? null,
            tickerSymbol: asset.tickerSymbol ?? cachedMetadata?.tickerSymbol ?? null,
            wkn: asset.wkn ?? cachedMetadata?.wkn ?? null,
            isin: asset.isin ?? null,
        });

        return {
            ...asset,
            name: resolved.name ?? null,

            assetName: asset.assetName ?? csvMetadata?.name ?? cachedMetadata?.assetName ?? null,
            displayName: asset.displayName ?? csvMetadata?.name ?? cachedMetadata?.displayName ?? null,
            title: asset.title ?? csvMetadata?.name ?? cachedMetadata?.title ?? null,

            symbol: asset.symbol ?? cachedMetadata?.symbol ?? cachedMetadata?.ticker ?? null,
            ticker: asset.ticker ?? cachedMetadata?.ticker ?? null,
            tickerSymbol: asset.tickerSymbol ?? cachedMetadata?.tickerSymbol ?? null,
            wkn: asset.wkn ?? cachedMetadata?.wkn ?? null,

            marketPrice: asset.marketPrice ?? cachedMetadata?.marketPrice ?? null,
            marketPriceAt: asset.marketPriceAt ?? cachedMetadata?.marketPriceAt ?? null,
            marketPriceSource: asset.marketPriceSource ?? cachedMetadata?.marketPriceSource ?? null,

            externalMetadata: {
                ...(asset.externalMetadata ?? {}),
                ...(cachedMetadata ?? {}),
                csvName: csvMetadata?.name ?? null,
                metadataSource: resolved.source,
            },
        };
    });
}