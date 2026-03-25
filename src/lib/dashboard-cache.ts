// src/lib/dashboard-cache.ts

import type { AssetSummary, ConsistencyReport } from "./types";

/**
 * Zentraler localStorage-Key fuer den Dashboard-Cache.
 *
 * Wichtig:
 * Wenn sich die Struktur des Cache-Payloads spaeter aendert,
 * sollte die Versionsnummer im Key erhoeht werden.
 */
export const DASHBOARD_CACHE_KEY = "parqet-dashboard-cache-v1";

/**
 * Ab wann der Datenstand als veraltet markiert werden soll.
 * Aktuell: 5 Tage.
 */
export const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Struktur des localStorage-Caches fuer das Dashboard.
 *
 * Ziel:
 * - letzte geladene Assets wiederherstellen
 * - Kennzahlen direkt nach Reload anzeigen
 * - zuletzt ausgewaehlte Portfolios merken
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
 * Liest den Dashboard-Cache aus localStorage.
 *
 * Rueckgabe:
 * - DashboardCache bei gueltigen Daten
 * - null bei leerem oder defektem Cache
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

        return JSON.parse(raw) as DashboardCache;
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
 * Praktisch fuer spaetere Reset-/Debug-Faelle.
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