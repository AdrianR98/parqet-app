// src/lib/dashboard-cache.ts

import type { AssetSummary, ConsistencyReport } from "./types";

/**
 * Zentraler localStorage-Key fuer den Dashboard-Cache.
 *
 * WICHTIG:
 * Version auf v2 erhoeht, weil sich die Asset-Struktur geaendert hat
 * und nun portfolioBreakdown erwartet wird.
 */
export const DASHBOARD_CACHE_KEY = "parqet-dashboard-cache-v2";

/**
 * Ab wann der Datenstand als veraltet markiert werden soll.
 * Aktuell: 5 Tage.
 */
export const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Struktur des localStorage-Caches fuer das Dashboard.
 */
export type DashboardCache = {
    activeAssets: AssetSummary[];
    closedAssets: AssetSummary[];
    rawActivityCount: number;
    filteredActivityCount: number;
    assetCount: number;
    activeAssetCount: number;
    closedAssetCount: number;
    consistencyReport: ConsistencyReport | null;
    lastUpdatedAt: string | null;
    selectedPortfolioIds: string[];
};

/**
 * Prueft, ob der Code im Browser laeuft.
 * localStorage darf nur dort angesprochen werden.
 */
function isBrowser(): boolean {
    return typeof window !== "undefined";
}

/**
 * Validiert grob, ob ein Asset bereits die neue Struktur besitzt.
 *
 * Entscheidend ist hier vor allem:
 * - portfolioBreakdown muss vorhanden und ein Array sein
 *
 * Hintergrund:
 * Aeltere Cache-Eintraege aus v1 enthalten dieses Feld nicht.
 * Diese Daten duerfen nicht mehr wiederhergestellt werden, weil die
 * neue AssetTable sonst nur Fallback-Zeilen mit 0-Werten anzeigt.
 */
function isCacheAssetCompatible(asset: unknown): asset is AssetSummary {
    if (!asset || typeof asset !== "object") {
        return false;
    }

    const candidate = asset as Partial<AssetSummary>;

    return (
        typeof candidate.isin === "string" &&
        Array.isArray(candidate.portfolioIds) &&
        Array.isArray(candidate.portfolioNames) &&
        Array.isArray(candidate.portfolioBreakdown)
    );
}

/**
 * Validiert grob die geladene Cache-Struktur.
 *
 * Wenn die neue Struktur nicht vorhanden ist, wird der Cache komplett
 * verworfen, damit die App sauber frische Daten vom Server holt.
 */
function isDashboardCacheCompatible(cache: unknown): cache is DashboardCache {
    if (!cache || typeof cache !== "object") {
        return false;
    }

    const candidate = cache as Partial<DashboardCache>;

    if (!Array.isArray(candidate.activeAssets) || !Array.isArray(candidate.closedAssets)) {
        return false;
    }

    const activeAssetsValid = candidate.activeAssets.every(isCacheAssetCompatible);
    const closedAssetsValid = candidate.closedAssets.every(isCacheAssetCompatible);

    return activeAssetsValid && closedAssetsValid;
}

/**
 * Liest den Dashboard-Cache aus localStorage.
 *
 * Rueckgabe:
 * - DashboardCache bei gueltigen Daten
 * - null bei leerem, defektem oder veraltetem Cache
 */
export function loadDashboardCache(): DashboardCache | null {
    if (!isBrowser()) {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as unknown;

        if (!isDashboardCacheCompatible(parsed)) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

/**
 * Schreibt den Dashboard-Cache in localStorage.
 *
 * Fehler werden bewusst still behandelt, damit das Dashboard
 * auch dann weiter funktioniert, wenn localStorage blockiert ist.
 */
export function saveDashboardCache(cache: DashboardCache): void {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // localStorage-Fehler bewusst ignorieren
    }
}

/**
 * Entfernt den Dashboard-Cache komplett.
 */
export function clearDashboardCache(): void {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.removeItem(DASHBOARD_CACHE_KEY);
    } catch {
        // localStorage-Fehler bewusst ignorieren
    }
}