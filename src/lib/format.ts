// Gemeinsame Format-Helfer fuer Zahlen und Darstellung.

import type { AssetSummary } from "./types";

// Diese Hilfsfunktion formatiert Zahlen als EUR.
export function formatCurrency(value: number | null): string {
    if (value === null || !Number.isFinite(value)) {
        return "-";
    }

    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
    }).format(value);
}

// Diese Hilfsfunktion formatiert Stueckzahlen.
export function formatShares(value: number): string {
    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    }).format(value);
}

// Diese Hilfsfunktion liefert eine einfache CSS-Klasse fuer Gewinn/Verlust.
export function getPnLClass(value: number | null): string {
    if (value === null) {
        return "";
    }

    if (value > 0) {
        return "parqet-positive";
    }

    if (value < 0) {
        return "parqet-negative";
    }

    return "";
}

// Vorlaeufiger Anzeigename fuer das Asset.
// Bis wir echte Asset-Metadaten haben, verwenden wir die ISIN.
export function getAssetDisplayName(asset: AssetSummary): string {
    return asset.isin;
}

// Baut die Logo-URL auf Basis der ISIN.
export function getAssetLogoUrl(asset: AssetSummary): string {
    return `https://assets.parqet.com/logos/isin/${asset.isin}?format=png`;
}

// Baut den Fallback-Text aus den ersten zwei Zeichen des Asset-Namens.
export function getAssetInitials(asset: AssetSummary): string {
    const name = getAssetDisplayName(asset).trim();

    if (!name) {
        return "??";
    }

    return name.slice(0, 2).toUpperCase();
}