// ============================================================
// src/lib/asset-metadata.ts
// ------------------------------------------------------------
// Clientseitiges Metadata-System fuer Dashboard und Cache.
// ============================================================

import type { AssetMetadata, GlobalAssetViewModel } from "./types";
import { CSV_ASSET_METADATA } from "./generated/csv-asset-metadata";
import {
  normalizeIsin,
  normalizeMetadata,
} from "./metadata-utils";

export const METADATA_STORAGE_KEY = "parqet-asset-metadata-cache-v1";

const LOCAL_METADATA_SEED: Record<string, AssetMetadata> = {};

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
      ]),
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
  incoming: Partial<AssetMetadata>,
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
    marketPriceSource:
      normalizedIncoming.marketPriceSource ?? current.marketPriceSource ?? null,
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

export function getMissingMetadataIsins(assets: GlobalAssetViewModel[]): string[] {
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

export function enrichAssetsWithMetadata(
  assets: GlobalAssetViewModel[],
): GlobalAssetViewModel[] {
  const mergedCache = getMergedAssetMetadataCache();

  return assets.map((asset) => {
    const normalized = normalizeIsin(asset.isin);
    const cachedMetadata = normalized ? mergedCache[normalized] : undefined;
    const authoritativeName =
      asset.instrument?.displayName ?? asset.instrument?.name ?? asset.name ?? cachedMetadata?.name ?? null;
    const authoritativeSymbol =
      asset.instrument?.primaryMapping?.symbol ?? asset.symbol ?? asset.ticker ?? cachedMetadata?.symbol ?? null;

    return {
      ...asset,
      name: authoritativeName ?? asset.name ?? null,
      symbol: authoritativeSymbol,
      ticker: authoritativeSymbol,
      wkn: asset.wkn ?? cachedMetadata?.wkn ?? null,
      metadata: {
        ...(asset.metadata ?? {}),
        ...(cachedMetadata ?? {}),
      },
      externalMetadata: {
        ...(asset.externalMetadata ?? {}),
        ...(cachedMetadata ?? {}),
      },
    };
  });
}
