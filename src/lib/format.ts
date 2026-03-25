import type { AssetSummary } from "./types";

export function formatCurrency(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
        return "—";
    }

    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatNumber(
    value: number | null | undefined,
    digits = 2
): string {
    if (value == null || Number.isNaN(value)) {
        return "—";
    }

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

export function formatShares(value: number | null | undefined): string {
    return formatNumber(value, 4);
}

export function getPnLClass(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
        return "";
    }

    if (value > 0) return "positive";
    if (value < 0) return "negative";
    return "";
}

// Name-Prioritaet:
// 1. echter Name
// 2. Symbol / Ticker
// 3. ISIN
export function getAssetDisplayName(asset: AssetSummary): string {
    if (asset.name && asset.name.trim().length > 0) {
        return asset.name;
    }

    if (asset.symbol && asset.symbol.trim().length > 0) {
        return asset.symbol;
    }

    return asset.isin;
}

export function getAssetSubtitle(asset: AssetSummary): string {
    const parts = [asset.symbol, asset.wkn, asset.isin].filter(
        (value): value is string => Boolean(value && value.trim())
    );

    return parts.join(" · ");
}

// Korrigierter pragmatischer Parqet-Logo-Pfad auf ISIN-Basis.
// Nicht als offiziell dokumentierte Connect-API-Funktion behandeln.
export function getAssetLogoUrl(asset: AssetSummary): string | null {
    if (!asset.isin) {
        return null;
    }

    return `https://assets.parqet.com/logos/isin/${encodeURIComponent(
        asset.isin
    )}?format=png`;
}

// Fallback fuer das "Icon":
// 1. Symbol / Ticker
// 2. Name
// 3. ISIN
export function getAssetIconText(asset: AssetSummary): string {
    if (asset.symbol && asset.symbol.trim().length > 0) {
        return asset.symbol.trim().slice(0, 5).toUpperCase();
    }

    if (asset.name && asset.name.trim().length > 0) {
        return asset.name.trim().slice(0, 2).toUpperCase();
    }

    return asset.isin.slice(0, 2).toUpperCase();
}