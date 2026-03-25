import type { AssetSummary } from "../types";

// Portfolio-Typ aus der Parqet Connect API.
export type Portfolio = {
    id: string;
    name: string;
    currency: string;
    createdAt: string;
    distinctBrokers: string[];
};

// Activity-Typ fuer Parqet.
// WICHTIG:
// Wir definieren bewusst mehrere moegliche Felder, weil APIs Metadaten
// je nach Event-Typ oder API-Version unterschiedlich liefern koennen.
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
    displayName?: string;

    asset?: {
        isin?: string;
        assetIdentifierType?: string;
        name?: string;
        symbol?: string;
        wkn?: string;
        ticker?: string;
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
        displayName?: string;
        shortName?: string;
        longName?: string;
        companyName?: string;
        instrumentName?: string;
    };
};

export type AssetAccumulator = AssetSummary;

export type AssetMetadata = {
    name: string | null;
    symbol: string | null;
    wkn: string | null;
};

export type AssetMetadataByIsin = Record<string, AssetMetadata>;