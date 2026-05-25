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

function isMeaningfulDisplayName(value: string | null | undefined, isin: string | null | undefined): value is string {
    if (typeof value !== "string") {
        return false;
    }
    const normalized = value.trim();
    if (!normalized) {
        return false;
    }
    if (normalized.toUpperCase() === String(isin ?? "").trim().toUpperCase()) {
        return false;
    }
    const lowered = normalized.toLowerCase();
    return lowered !== "unknown" && lowered !== "n/a" && lowered !== "undefined" && lowered !== "null";
}

function pickFirstMeaningfulName(
    isin: string | null | undefined,
    ...candidates: Array<string | null | undefined>
): string | null {
    for (const candidate of candidates) {
        if (isMeaningfulDisplayName(candidate, isin)) {
            return candidate.trim();
        }
    }
    return null;
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
        const cachedMetadata = normalized ? mergedCache[normalized] : undefined;
        const fallbackDisplayName = pickFirstMeaningfulName(
            asset.isin,
            asset.instrument?.displayName ?? null,
            asset.instrument?.name ?? null,
            asset.instrumentDisplayName ?? null,
            typeof asset.externalMetadata?.curatedName === "string" ? asset.externalMetadata.curatedName : null,
            typeof asset.externalMetadata?.displayName === "string" ? asset.externalMetadata.displayName : null,
            asset.curatedName ?? null,
            asset.displayName ?? null,
            asset.name ?? null,
        );
        const hasAuthoritativeInstrumentStatus = typeof asset.instrumentMetadataStatus === "string";
        const strictInstrumentDisplayName = pickFirstMeaningfulName(
            asset.isin,
            asset.instrument?.displayName ?? null,
            asset.instrument?.name ?? null,
            asset.instrumentDisplayName ?? null,
            asset.instrumentName ?? null,
        );
        const authoritativeDisplayName = hasAuthoritativeInstrumentStatus
            ? strictInstrumentDisplayName
            : fallbackDisplayName;
        const authoritativeInstrumentSymbol = asset.instrument?.primaryMapping?.symbol ?? null;
        const metadataError =
            asset.instrumentMetadataError ??
            (asset.instrumentMetadataStatus === "missing"
                ? `Keine Stammdaten in market_instruments für ISIN ${asset.isin}`
                : asset.instrumentMetadataStatus === "missing_name"
                    ? `Instrumentenname fehlt in market_instruments für ISIN ${asset.isin}`
                    : asset.instrumentMetadataStatus === "db_unavailable"
                        ? "Instrumenten-Stammdaten konnten nicht aus der Datenbank geladen werden"
                        : null);

        return {
            ...asset,
            name: authoritativeDisplayName ?? (asset.instrumentMetadataStatus === "ok" ? null : "Stammdaten fehlen"),

            assetName: authoritativeDisplayName ?? (asset.instrumentMetadataStatus === "ok" ? null : "Stammdaten fehlen"),
            displayName: authoritativeDisplayName ?? (asset.instrumentMetadataStatus === "ok" ? null : "Stammdaten fehlen"),
            title: authoritativeDisplayName ?? (asset.instrumentMetadataStatus === "ok" ? null : "Stammdaten fehlen"),
            curatedName: authoritativeDisplayName ?? null,
            instrumentDisplayName: authoritativeDisplayName ?? null,
            instrumentMetadataError: metadataError,

            symbol: authoritativeInstrumentSymbol ?? asset.symbol ?? (hasAuthoritativeInstrumentStatus ? null : (cachedMetadata?.symbol ?? cachedMetadata?.ticker ?? null)),
            ticker: authoritativeInstrumentSymbol ?? asset.ticker ?? (hasAuthoritativeInstrumentStatus ? null : (cachedMetadata?.ticker ?? null)),
            tickerSymbol: authoritativeInstrumentSymbol ?? asset.tickerSymbol ?? (hasAuthoritativeInstrumentStatus ? null : (cachedMetadata?.tickerSymbol ?? null)),
            wkn: asset.wkn ?? cachedMetadata?.wkn ?? null,

            marketPrice: asset.marketPrice ?? cachedMetadata?.marketPrice ?? null,
            marketPriceAt: asset.marketPriceAt ?? cachedMetadata?.marketPriceAt ?? null,
            marketPriceSource: asset.marketPriceSource ?? cachedMetadata?.marketPriceSource ?? null,

            externalMetadata: {
                ...(asset.externalMetadata ?? {}),
                ...(cachedMetadata ?? {}),
                csvName: csvMetadata?.name ?? null,
                metadataSource: asset.metadataSource ?? null,
                instrumentMetadataStatus: asset.instrumentMetadataStatus ?? undefined,
                instrumentMetadataError: metadataError,
            },
        };
    });
}
