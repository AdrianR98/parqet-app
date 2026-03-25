// ============================================================
// src/lib/activity-types.ts
// ------------------------------------------------------------
// Gemeinsame Typen fuer den Activity-/Parsing-Layer.
//
// Wichtig:
// - tolerant gegen unterschiedliche Parqet-API-Formen
// - zentrale Typnutzung aus src/lib/types.ts
// - keine parallelen Metadata-Typdefinitionen
// ============================================================

import type { AssetMetadata, AssetSummary } from "../types";

/**
 * Portfolio-Typ aus der Parqet Connect API.
 *
 * Hinweis:
 * Dieser Typ wird hier weiterhin lokal vorgehalten, weil der Activity-/Parsing-
 * Layer fachlich nah an den von Parqet gelieferten Rohdaten liegt.
 */
export type Portfolio = {
    id: string;
    name: string;
    currency: string;
    createdAt: string;
    distinctBrokers: string[];
};

/**
 * Activity-Typ fuer Parqet.
 *
 * WICHTIG:
 * Wir definieren bewusst mehrere moegliche Felder, weil APIs Metadaten
 * je nach Event-Typ oder API-Version unterschiedlich liefern koennen.
 *
 * Ziel:
 * Der Parsing-Layer soll tolerant gegen unterschiedliche API-Formen bleiben.
 */
export type Activity = {
    id: string;
    type: string;

    shares?: number | string;
    amount?: number | string;
    amountNet?: number | string;
    price?: number | string;
    fee?: number | string;
    tax?: number | string;

    currency?: string;
    datetime: string;

    holdingId?: string;
    holdingName?: string;
    holdingAssetType?: string;

    portfolioId?: string;

    isin?: string;
    name?: string;
    symbol?: string;
    wkn?: string;
    ticker?: string;
    tickerSymbol?: string;
    displayName?: string;

    asset?: {
        isin?: string;
        assetIdentifierType?: string;
        name?: string;
        symbol?: string;
        wkn?: string;
        ticker?: string;
        tickerSymbol?: string;
        displayName?: string;
        shortName?: string;
        longName?: string;
        companyName?: string;
        instrumentName?: string;
    };

    security?: {
        isin?: string;
        name?: string;
        symbol?: string;
        wkn?: string;
        ticker?: string;
        tickerSymbol?: string;
        displayName?: string;
        shortName?: string;
        longName?: string;
        companyName?: string;
        instrumentName?: string;
    };
};

/**
 * Interner Akkumulator waehrend der Gruppierung.
 *
 * Der Akkumulator basiert bewusst direkt auf AssetSummary, damit:
 * - Gruppierungslogik und finaler Rueckgabetyp konsistent bleiben
 * - neue Felder wie portfolioBreakdown nicht doppelt gepflegt werden muessen
 */
export type AssetAccumulator = AssetSummary;

// ============================================================
// Asset metadata map by ISIN
// ------------------------------------------------------------
// Zentrale Metadata-Struktur fuer serverseitiges Enrichment.
// Nutzt denselben AssetMetadata-Typ wie UI und Cache,
// damit keine Typabweichungen zwischen API und Frontend entstehen.
// ============================================================

export type AssetMetadataByIsin = Record<string, AssetMetadata>;