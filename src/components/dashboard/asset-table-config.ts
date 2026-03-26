// src/components/dashboard/asset-table-config.ts

import type { AssetSummary, PortfolioPosition } from "../../lib/types";

/**
 * ============================================================
 * TABELLENKONFIGURATION
 * ============================================================
 *
 * Zentraler Ort für:
 * - Spaltenkeys
 * - fixe Spalten
 * - Default-Spalten
 * - Spaltenbreiten
 * - Sortierung
 *
 * Typische Erweiterungspunkte:
 * - weitere Spalten
 * - persistente Spaltenprofile
 * - zusätzliche Sortiermodi
 */

export type VisibleColumnKey =
    | "name"
    | "positionValue"
    | "netShares"
    | "avgBuyPrice"
    | "latestTradePrice"
    | "unrealizedPnL"
    | "totalDividendNet"
    | "latestActivityAt"
    | "actions";

export type AssetSortKey =
    | "name"
    | "positionValue"
    | "netShares"
    | "avgBuyPrice"
    | "latestTradePrice"
    | "unrealizedPnL"
    | "totalDividendNet"
    | "latestActivityAt";

export const FIXED_COLUMNS: VisibleColumnKey[] = ["name", "positionValue"];

export const DEFAULT_VISIBLE_COLUMNS: VisibleColumnKey[] = [
    "name",
    "positionValue",
    "netShares",
    "avgBuyPrice",
    "latestTradePrice",
    "unrealizedPnL",
    "totalDividendNet",
    "latestActivityAt",
    "actions",
];

/**
 * ============================================================
 * SPALTENBREITEN
 * ============================================================
 */
const COLUMN_MIN_WIDTH: Record<VisibleColumnKey, number> = {
    name: 320,
    positionValue: 150,
    netShares: 120,
    avgBuyPrice: 120,
    latestTradePrice: 120,
    unrealizedPnL: 140,
    totalDividendNet: 130,
    latestActivityAt: 150,
    actions: 110,
};

export function getColumnMinWidth(key: VisibleColumnKey): number {
    return COLUMN_MIN_WIDTH[key];
}

/**
 * ============================================================
 * SPALTENLABELS
 * ============================================================
 */
export function getColumnLabel(key: VisibleColumnKey): string {
    switch (key) {
        case "name":
            return "Name";
        case "positionValue":
            return "Positionswert";
        case "netShares":
            return "Bestand";
        case "avgBuyPrice":
            return "Ø Kaufpreis";
        case "latestTradePrice":
            return "Letzter Preis";
        case "unrealizedPnL":
            return "Unrealisiert";
        case "totalDividendNet":
            return "Dividenden";
        case "latestActivityAt":
            return "Letzte Aktivität";
        case "actions":
            return "Aktionen";
        default:
            return key;
    }
}

/**
 * ============================================================
 * FORMAT / SAFETY
 * ============================================================
 */
export function getSafePortfolioBreakdown(asset: AssetSummary): PortfolioPosition[] {
    return Array.isArray(asset.portfolioBreakdown) ? asset.portfolioBreakdown : [];
}

/**
 * ============================================================
 * SORTIERUNG
 * ============================================================
 */
function normalizeNullableNumber(value: number | null | undefined): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeNullableString(value: string | null | undefined): string {
    return (value ?? "").toLowerCase();
}

function compareValues(
    left: number | string,
    right: number | string,
    direction: "asc" | "desc"
): number {
    let result = 0;

    if (typeof left === "number" && typeof right === "number") {
        result = left - right;
    } else {
        result = String(left).localeCompare(String(right), "de");
    }

    return direction === "asc" ? result : result * -1;
}

export function sortAssets(
    assets: AssetSummary[],
    sortKey: AssetSortKey,
    sortDirection: "asc" | "desc"
): AssetSummary[] {
    const next = [...assets];

    next.sort((a, b) => {
        switch (sortKey) {
            case "name":
                return compareValues(
                    normalizeNullableString(a.name ?? a.assetName ?? a.isin),
                    normalizeNullableString(b.name ?? b.assetName ?? b.isin),
                    sortDirection
                );

            case "positionValue":
                return compareValues(
                    normalizeNullableNumber(a.positionValue),
                    normalizeNullableNumber(b.positionValue),
                    sortDirection
                );

            case "netShares":
                return compareValues(
                    normalizeNullableNumber(a.netShares),
                    normalizeNullableNumber(b.netShares),
                    sortDirection
                );

            case "avgBuyPrice":
                return compareValues(
                    normalizeNullableNumber(a.avgBuyPrice),
                    normalizeNullableNumber(b.avgBuyPrice),
                    sortDirection
                );

            case "latestTradePrice":
                return compareValues(
                    normalizeNullableNumber(a.latestTradePrice),
                    normalizeNullableNumber(b.latestTradePrice),
                    sortDirection
                );

            case "unrealizedPnL":
                return compareValues(
                    normalizeNullableNumber(a.unrealizedPnL),
                    normalizeNullableNumber(b.unrealizedPnL),
                    sortDirection
                );

            case "totalDividendNet":
                return compareValues(
                    normalizeNullableNumber(a.totalDividendNet),
                    normalizeNullableNumber(b.totalDividendNet),
                    sortDirection
                );

            case "latestActivityAt":
                return compareValues(
                    normalizeNullableString(a.latestActivityAt),
                    normalizeNullableString(b.latestActivityAt),
                    sortDirection
                );

            default:
                return 0;
        }
    });

    return next;
}