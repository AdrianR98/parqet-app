// src/lib/dashboard-helpers.ts

import type { AssetSummary, DashboardStats } from "./types";
import { FIVE_DAYS_MS } from "./dashboard-cache";

/**
 * Baut die zentralen Dashboard-Kennzahlen aus aktiven und geschlossenen Assets.
 *
 * Die Summen werden ueber beide Listen berechnet, damit die Gesamtsicht
 * konsistent bleibt.
 */
export function buildDashboardStats(params: {
    activeAssets: AssetSummary[];
    closedAssets: AssetSummary[];
    rawActivityCount: number;
    filteredActivityCount: number;
    assetCount: number;
    activeAssetCount: number;
    closedAssetCount: number;
}): DashboardStats {
    const {
        activeAssets,
        closedAssets,
        rawActivityCount,
        filteredActivityCount,
        assetCount,
        activeAssetCount,
        closedAssetCount,
    } = params;

    const allAssets = [...activeAssets, ...closedAssets];

    let totalDividendNet = 0;
    let totalPositionValue = 0;
    let totalUnrealizedPnL = 0;

    for (const asset of allAssets) {
        totalDividendNet += asset.totalDividendNet;
        totalPositionValue += asset.positionValue ?? 0;
        totalUnrealizedPnL += asset.unrealizedPnL ?? 0;
    }

    return {
        rawActivityCount,
        filteredActivityCount,
        assetCount,
        activeAssetCount,
        closedAssetCount,
        totalDividendNet,
        totalPositionValue,
        totalUnrealizedPnL,
    };
}

/**
 * Sortiert aktive Assets primär nach Positionswert, sekundär nach letzter Aktivitaet.
 *
 * Das entspricht der gewohnten Priorisierung im Dashboard:
 * grosse Positionen zuerst.
 */
export function sortActiveAssets(assets: AssetSummary[]): AssetSummary[] {
    return [...assets].sort((a, b) => {
        const aValue = a.positionValue ?? 0;
        const bValue = b.positionValue ?? 0;

        if (bValue !== aValue) {
            return bValue - aValue;
        }

        const aTime = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : 0;
        const bTime = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : 0;

        return bTime - aTime;
    });
}

/**
 * Sortiert geschlossene Assets nach letzter Aktivitaet.
 *
 * Bei geschlossenen Positionen ist die zeitliche Relevanz meist sinnvoller
 * als der Positionswert, da letzterer haeufig 0 ist.
 */
export function sortClosedAssets(assets: AssetSummary[]): AssetSummary[] {
    return [...assets].sort((a, b) => {
        const aTime = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : 0;
        const bTime = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : 0;

        return bTime - aTime;
    });
}

/**
 * Prueft, ob der letzte Datenstand aelter als 5 Tage ist.
 */
export function isDashboardDataStale(lastUpdatedAt: string | null): boolean {
    if (!lastUpdatedAt) {
        return false;
    }

    const age = Date.now() - new Date(lastUpdatedAt).getTime();
    return age > FIVE_DAYS_MS;
}