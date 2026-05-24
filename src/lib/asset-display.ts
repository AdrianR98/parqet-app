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

    return asset.isin;
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
    const symbol = getAssetSymbol(asset);
    const wkn = getAssetWkn(asset);

    if (symbol && wkn && symbol !== wkn) {
        return `${symbol} • ${wkn}`;
    }

    if (symbol) {
        return symbol;
    }

    if (wkn) {
        return wkn;
    }

    return asset.isin;
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
