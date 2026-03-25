// ============================================================
// src/lib/parqet-assets/metadata.ts
// ------------------------------------------------------------
// Serverseitige Metadata-Quelle fuer die Asset-Pipeline.
//
// Ziel:
// - keine externe API
// - CSV-generierte Namen als Primaerquelle
// - spaeter leicht auf DB / Overrides erweiterbar
// ============================================================

import type { AssetMetadata } from "../types";
import { CSV_ASSET_METADATA } from "../generated/csv-asset-metadata";
import { normalizeIsin, normalizeMetadata } from "../metadata-utils";
import type { AssetMetadataByIsin } from "./activity-types";

// ============================================================
// Lokaler manueller Seed
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
// Public API
// ============================================================

export async function loadAssetMetadataByIsin(
    isins: string[]
): Promise<AssetMetadataByIsin> {
    const result: AssetMetadataByIsin = {};

    const uniqueIsins = Array.from(
        new Set(
            isins
                .map((isin) => normalizeIsin(isin))
                .filter(Boolean)
        )
    ) as string[];

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