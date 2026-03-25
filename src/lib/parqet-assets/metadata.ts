// ============================================================
// src/lib/parqet-assets/metadata.ts
// ------------------------------------------------------------
// Serverseitige Metadata-Quelle fuer die Asset-Pipeline.
//
// Ziel:
// - keine externe API
// - CSV-generierte Namen als Primaerquelle
// - stabile Antwortstruktur fuer die Assets-Route
// ============================================================

import type { AssetMetadata } from "../types";
import { CSV_ASSET_METADATA } from "../generated/csv-asset-metadata";
import type { AssetMetadataByIsin } from "./activity-types";

// ============================================================
// Lokaler manueller Zusatz-Seed
// ------------------------------------------------------------
// Hier koennen spaeter gezielt Einzelfaelle ergaenzt werden,
// falls die CSV einen Namen nicht enthaelt.
// ============================================================

const LOCAL_METADATA_SEED: Record<string, AssetMetadata> = {
    // Beispiel:
    // "US0378331005": {
    //     name: "Apple Inc.",
    //     symbol: "AAPL",
    //     wkn: "865985",
    // },
};

// ============================================================
// Helper
// ============================================================

function normalizeIsin(value: string): string {
    return value.trim().toUpperCase();
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
        marketPrice: typeof input?.marketPrice === "number" ? input.marketPrice : null,
        marketPriceAt: sanitizeString(input?.marketPriceAt),
        marketPriceSource: sanitizeString(input?.marketPriceSource),
        currency: sanitizeString(input?.currency),
        assetType: sanitizeString(input?.assetType),
        exchange: sanitizeString(input?.exchange),
    };
}

// ============================================================
// Oeffentliche Metadata-Quelle
// ------------------------------------------------------------
// Prioritaet innerhalb der lokalen Quellen:
// 1) CSV-generierte Metadata
// 2) manueller lokaler Seed
//
// Wichtig:
// Die Activity-Daten werden NICHT hier gemischt,
// sondern erst in der Assets-Route beim finalen Merge.
// ============================================================

export async function loadAssetMetadataByIsin(
    isins: string[]
): Promise<AssetMetadataByIsin> {
    const result: AssetMetadataByIsin = {};
    const uniqueIsins = Array.from(
        new Set(
            isins
                .filter(Boolean)
                .map(normalizeIsin)
        )
    );

    for (const isin of uniqueIsins) {
        const csvMetadata = CSV_ASSET_METADATA[isin];
        const localMetadata = LOCAL_METADATA_SEED[isin];

        result[isin] = normalizeMetadata({
            ...localMetadata,
            ...csvMetadata,
        });
    }

    return result;
}