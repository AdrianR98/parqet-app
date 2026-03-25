import type { AssetMetadata, AssetSummary } from "./types";

const METADATA_STORAGE_KEY = "parqet-asset-metadata-cache-v1";

/**
 * Lokaler Seed fuer bekannte Assets.
 * Hier kannst du manuell hochwertige Stammdaten hinterlegen.
 *
 * Vorteil:
 * - sofort bessere UI
 * - keine externe API noetig
 * - spaeter leicht durch echten Provider erweiterbar
 */
const LOCAL_METADATA_SEED: Record<string, AssetMetadata> = {
    // Beispiel:
    // "US5949181045": {
    //   name: "Microsoft Corp.",
    //   symbol: "MSFT",
    //   wkn: "870747",
    // },
    // "US0378331005": {
    //   name: "Apple Inc.",
    //   symbol: "AAPL",
    //   wkn: "865985",
    // },
};

type AssetMetadataCache = Record<string, AssetMetadata>;

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

/**
 * Liest den lokalen Browser-Cache.
 */
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
            Object.entries(parsed).map(([isin, metadata]) => [isin, normalizeMetadata(metadata)])
        );
    } catch {
        return {};
    }
}

/**
 * Schreibt den lokalen Browser-Cache.
 */
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

/**
 * Kombiniert Seed + Cache.
 * Seed ist die Basis, Cache kann spaeter ergaenzend oder ueberschreibend wirken.
 */
export function getMergedAssetMetadataCache(): AssetMetadataCache {
    const browserCache = loadAssetMetadataCache();

    return {
        ...LOCAL_METADATA_SEED,
        ...browserCache,
    };
}

/**
 * Fuegt neue Metadaten in den Cache ein.
 * Bestehende Werte bleiben erhalten, wenn neue Werte leer sind.
 */
export function upsertAssetMetadata(
    isin: string,
    incoming: Partial<AssetMetadata>
): AssetMetadataCache {
    const currentCache = getMergedAssetMetadataCache();
    const normalizedIncoming = normalizeMetadata(incoming);
    const current = currentCache[isin] ?? {};

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
        [isin]: next,
    };

    saveAssetMetadataCache(nextCache);

    return nextCache;
}

/**
 * Liefert fuer eine Asset-Liste die noch fehlenden ISINs.
 * Diese Liste ist spaeter ideal fuer einen echten Metadata-Fetcher.
 */
export function getMissingMetadataIsins(assets: AssetSummary[]): string[] {
    const cache = getMergedAssetMetadataCache();

    return assets
        .map((asset) => asset.isin)
        .filter((isin) => {
            const meta = cache[isin];

            return !meta || (!meta.name && !meta.symbol && !meta.wkn);
        });
}

/**
 * Fuegt Metadaten in die Asset-Liste ein, ohne die bestehende Struktur zu zerstoeren.
 *
 * Prioritaet:
 * - vorhandene Asset-Felder bleiben erhalten
 * - Cache landet in externalMetadata
 * - marketPrice-Felder koennen ebenfalls mit uebernommen werden
 */
export function enrichAssetsWithMetadata(assets: AssetSummary[]): AssetSummary[] {
    const cache = getMergedAssetMetadataCache();

    return assets.map((asset) => {
        const cachedMetadata = cache[asset.isin];

        if (!cachedMetadata) {
            return asset;
        }

        return {
            ...asset,

            name: asset.name ?? cachedMetadata.name ?? null,
            assetName: asset.assetName ?? cachedMetadata.assetName ?? null,
            displayName: asset.displayName ?? cachedMetadata.displayName ?? null,
            title: asset.title ?? cachedMetadata.title ?? null,

            symbol: asset.symbol ?? cachedMetadata.symbol ?? cachedMetadata.ticker ?? null,
            ticker: asset.ticker ?? cachedMetadata.ticker ?? null,
            tickerSymbol: asset.tickerSymbol ?? cachedMetadata.tickerSymbol ?? null,

            wkn: asset.wkn ?? cachedMetadata.wkn ?? null,

            marketPrice: asset.marketPrice ?? cachedMetadata.marketPrice ?? null,
            marketPriceAt: asset.marketPriceAt ?? cachedMetadata.marketPriceAt ?? null,
            marketPriceSource:
                asset.marketPriceSource ?? cachedMetadata.marketPriceSource ?? null,

            externalMetadata: {
                ...(asset.externalMetadata ?? {}),
                ...cachedMetadata,
            },
        };
    });
}