// src/lib/asset-display.ts

import type { AssetSummary } from "./types";

/**
 * Prueft, ob ein Wert als sinnvoller UI-String verwendet werden kann.
 */
function isNonEmptyDisplayString(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }

    const normalized = value.trim();

    if (!normalized) {
        return false;
    }

    const lowered = normalized.toLowerCase();

    return lowered !== "undefined" && lowered !== "null" && lowered !== "n/a";
}

/**
 * Gibt den ersten gueltigen String aus einer priorisierten Liste zurueck.
 */
function pickFirstDisplayString(...candidates: unknown[]): string | null {
    for (const candidate of candidates) {
        if (isNonEmptyDisplayString(candidate)) {
            return candidate.trim();
        }
    }

    return null;
}

function normalizeIdentifier(value: unknown): string | null {
    if (!isNonEmptyDisplayString(value)) {
        return null;
    }

    return value.trim().toUpperCase();
}

function isIsinLike(value: unknown): value is string {
    if (!isNonEmptyDisplayString(value)) {
        return false;
    }
    return /^[A-Z0-9]{12}$/.test(value.trim().toUpperCase());
}

/**
 * Sammelt optionale Metadaten-Container in einer festen Reihenfolge.
 */
function getMetadataCandidates(
    asset: AssetSummary
): Array<NonNullable<AssetSummary["metadata"]>> {
    const candidates: Array<NonNullable<AssetSummary["metadata"]>> = [];

    if (asset.metadata && typeof asset.metadata === "object") {
        candidates.push(asset.metadata);
    }

    if (asset.externalMetadata && typeof asset.externalMetadata === "object") {
        candidates.push(asset.externalMetadata);
    }

    if (asset.assetMeta && typeof asset.assetMeta === "object") {
        candidates.push(asset.assetMeta);
    }

    return candidates;
}

function getKnownIdentifiers(asset: AssetSummary): Set<string> {
    const identifiers = new Set<string>();

    for (const candidate of [
        asset.isin,
        asset.wkn,
        asset.symbol,
        asset.ticker,
        asset.tickerSymbol,
    ]) {
        const normalized = normalizeIdentifier(candidate);

        if (normalized) {
            identifiers.add(normalized);
        }
    }

    for (const metadata of getMetadataCandidates(asset)) {
        for (const candidate of [
            metadata.wkn,
            metadata.symbol,
            metadata.ticker,
            metadata.tickerSymbol,
        ]) {
            const normalized = normalizeIdentifier(candidate);

            if (normalized) {
                identifiers.add(normalized);
            }
        }
    }

    return identifiers;
}

function pickFirstNonIdentifierName(asset: AssetSummary, ...candidates: unknown[]): string | null {
    const identifiers = getKnownIdentifiers(asset);

    for (const candidate of candidates) {
        const value = pickFirstDisplayString(candidate);

        if (!value) {
            continue;
        }

        const normalized = normalizeIdentifier(value);

        if (normalized && identifiers.has(normalized)) {
            continue;
        }

        return value;
    }

    return null;
}

/**
 * Liefert bevorzugt Symbol / Ticker.
 */
export function getAssetSymbol(asset: AssetSummary): string | null {
    const directSymbol = pickFirstDisplayString(
        asset.symbol,
        asset.ticker,
        asset.tickerSymbol
    );

    if (directSymbol) {
        return directSymbol;
    }

    for (const metadata of getMetadataCandidates(asset)) {
        const metadataSymbol = pickFirstDisplayString(
            metadata.symbol,
            metadata.ticker,
            metadata.tickerSymbol
        );

        if (metadataSymbol) {
            return metadataSymbol;
        }
    }

    return null;
}

export function isMeaningfulSymbol(symbol: string | null, isin: string): boolean {
    const normalizedSymbol = normalizeIdentifier(symbol);
    const normalizedIsin = normalizeIdentifier(isin);
    if (!normalizedSymbol || !normalizedIsin) {
        return false;
    }
    return normalizedSymbol !== normalizedIsin;
}

export function getAuthoritativeTicker(asset: AssetSummary): string | null {
    const instrumentSymbol = pickFirstDisplayString(asset.instrument?.primaryMapping?.symbol);
    if (instrumentSymbol && isMeaningfulSymbol(instrumentSymbol, asset.isin)) {
        return instrumentSymbol;
    }

    if (isIsinLike(asset.isin)) {
        return null;
    }

    const fallbackSymbol = pickFirstDisplayString(asset.symbol, asset.ticker, asset.tickerSymbol);
    if (fallbackSymbol && isMeaningfulSymbol(fallbackSymbol, asset.isin)) {
        return fallbackSymbol;
    }

    return null;
}

export function buildInstrumentSubtitleParts(asset: AssetSummary): string[] {
    const parts: string[] = [];
    const isin = pickFirstDisplayString(asset.isin);
    const wkn = getAssetWkn(asset);
    const ticker = getAuthoritativeTicker(asset);

    if (isin) {
        parts.push(`ISIN ${isin}`);
    }
    if (wkn) {
        parts.push(`WKN ${wkn}`);
    }
    if (ticker) {
        parts.push(`TICKER ${ticker}`);
    }

    return parts;
}

/**
 * Liefert bevorzugt die WKN.
 */
export function getAssetWkn(asset: AssetSummary): string | null {
    const directWkn = pickFirstDisplayString(asset.wkn);

    if (directWkn) {
        return directWkn;
    }

    for (const metadata of getMetadataCandidates(asset)) {
        const metadataWkn = pickFirstDisplayString(metadata.wkn);

        if (metadataWkn) {
            return metadataWkn;
        }
    }

    return null;
}

/**
 * Name-Fallback-Kette fuer V1-Anzeige:
 * 1. Lokale / angereicherte Metadaten-Namen
 * 2. Direktes Name-Feld am Asset, sofern es nicht nur ISIN/WKN/Ticker ist
 * 3. Symbol / Ticker
 * 4. WKN
 * 5. ISIN
 */
export function getAssetDisplayName(asset: AssetSummary): string {
    if (isIsinLike(asset.isin) && asset.instrumentMetadataStatus !== "ok") {
        return "Stammdaten fehlen";
    }

    if (isIsinLike(asset.isin) && asset.instrumentMetadataStatus === "ok") {
        const strictInstrumentDisplayName = pickFirstDisplayString(
            asset.instrument?.displayName,
            asset.instrument?.name,
            asset.instrumentDisplayName,
            asset.instrumentName
        );
        return strictInstrumentDisplayName ?? "Stammdaten fehlen";
    }

    const instrumentDisplayName = pickFirstDisplayString(
        asset.instrumentDisplayName,
        asset.curatedName,
        asset.displayName,
        asset.name
    );
    if (instrumentDisplayName) {
        return instrumentDisplayName;
    }

    for (const metadata of getMetadataCandidates(asset)) {
        const metadataName = pickFirstNonIdentifierName(
            asset,
            metadata.curatedName,
            metadata.displayName,
            metadata.name,
            metadata.assetName,
            metadata.title
        );

        if (metadataName) {
            return metadataName;
        }
    }

    const directName = pickFirstNonIdentifierName(
        asset,
        asset.curatedName,
        asset.displayName,
        asset.name,
        asset.assetName,
        asset.title
    );

    if (directName) {
        return directName;
    }

    const symbol = getAssetSymbol(asset);

    if (symbol) {
        return symbol;
    }

    const wkn = getAssetWkn(asset);

    if (wkn) {
        return wkn;
    }

    return "Stammdaten fehlen";
}

/**
 * Subtitle fuer die zweite Zeile:
 * - Symbol bevorzugen
 * - sonst WKN
 * - sonst ISIN
 *
 * Wenn Symbol und WKN vorhanden und unterschiedlich sind,
 * werden beide kombiniert.
 */
export function getAssetSubtitle(asset: AssetSummary): string {
    if (isIsinLike(asset.isin) && asset.instrumentMetadataStatus !== "ok") {
        const base = `ISIN ${asset.isin}`;
        if (asset.instrumentMetadataError) {
            return `${base} • ${asset.instrumentMetadataError}`;
        }
        return `${base} • Instrumenten-Stammdaten fehlen`;
    }

    const symbol = getAuthoritativeTicker(asset);
    const wkn = getAssetWkn(asset);

    if (wkn) {
        return `ISIN ${asset.isin} • WKN ${wkn}`;
    }
    if (symbol) {
        return `ISIN ${asset.isin} • TICKER ${symbol}`;
    }
    return `ISIN ${asset.isin}`;
}

/**
 * Parqet-Asset-Logo anhand der ISIN.
 */
export function getAssetLogoUrl(asset: AssetSummary): string {
    return `https://assets.parqet.com/logos/isin/${asset.isin}?format=png`;
}

/**
 * Liefert bevorzugt ein vorhandenes Metadaten-Logo und faellt sonst auf
 * die ISIN-basierte Logo-URL zurueck.
 */
export function getAssetResolvedLogoUrl(asset: AssetSummary): string | null {
    for (const metadata of getMetadataCandidates(asset)) {
        const logoUrl = pickFirstDisplayString((metadata as { logoUrl?: unknown }).logoUrl);
        if (logoUrl) {
            return logoUrl;
        }
    }

    if (!isNonEmptyDisplayString(asset.isin)) {
        return null;
    }

    return getAssetLogoUrl(asset);
}

/**
 * Baut robuste Initialen fuer den Logo-Fallback.
 */
export function getAssetInitials(asset: AssetSummary): string {
    const displayName = getAssetDisplayName(asset);

    if (!isNonEmptyDisplayString(displayName)) {
        return "??";
    }

    const parts = displayName
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length >= 2) {
        const initials = `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
        return initials || "??";
    }

    const compact = displayName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    if (compact.length >= 2) {
        return compact.slice(0, 2);
    }

    if (compact.length === 1) {
        return `${compact}?`;
    }

    return "??";
}
