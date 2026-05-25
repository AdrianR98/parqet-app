import "server-only";

import type { AssetSummary } from "../types";
import { recordMarketDataRequest } from "./db/repository";

function normalizeIsin(value: string | null | undefined): string {
    return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

function isValidIsin(value: string): boolean {
    return /^[A-Z0-9]{12}$/.test(value);
}

function pickText(...values: Array<string | null | undefined>): string | null {
    for (const value of values) {
        if (typeof value !== "string") continue;
        const normalized = value.trim();
        if (normalized) return normalized;
    }
    return null;
}

export function buildUnknownMarketDataRequestCandidates(input: {
    assets: AssetSummary[];
    knownIsins: Set<string>;
}): Array<{
    isin: string;
    name: string | null;
    displayName: string | null;
    assetType: string | null;
    currency: string | null;
    wkn: string | null;
}> {
    const candidates = new Map<string, {
        isin: string;
        name: string | null;
        displayName: string | null;
        assetType: string | null;
        currency: string | null;
        wkn: string | null;
    }>();

    for (const asset of input.assets) {
        const isin = normalizeIsin(asset.isin);
        if (!isValidIsin(isin)) continue;
        if (input.knownIsins.has(isin)) continue;
        if (candidates.has(isin)) continue;

        candidates.set(isin, {
            isin,
            name: pickText(asset.instrumentName, asset.name, asset.assetName, asset.metadata?.name),
            displayName: pickText(asset.instrumentDisplayName, asset.displayName, asset.title, asset.metadata?.displayName),
            assetType: pickText(asset.instrument?.assetType, asset.externalMetadata?.assetType, asset.metadata?.assetType, asset.assetMeta?.assetType),
            currency: pickText(asset.instrument?.currency, asset.externalMetadata?.currency, asset.metadata?.currency, asset.assetMeta?.currency),
            wkn: pickText(asset.instrument?.wkn, asset.wkn, asset.metadata?.wkn, asset.externalMetadata?.wkn),
        });
    }

    return Array.from(candidates.values());
}

export async function recordUnknownMarketDataRequestsFromAssets(input: {
    assets: AssetSummary[];
    knownIsins: Set<string>;
}): Promise<{ attempted: number; recorded: number }> {
    const candidates = buildUnknownMarketDataRequestCandidates(input);
    let recorded = 0;

    for (const candidate of candidates) {
        const row = await recordMarketDataRequest({
            ...candidate,
            source: "runtime_asset_discovery",
        });

        if (row) recorded += 1;
    }

    return {
        attempted: candidates.length,
        recorded,
    };
}
