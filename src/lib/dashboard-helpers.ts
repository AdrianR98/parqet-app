// src/lib/dashboard-helpers.ts

import type { GlobalAssetViewModel, DashboardStats } from "./types";
import { FIVE_DAYS_MS } from "./dashboard-cache";
import type { ProductReadModelAssets } from "./parqet/global-assets/product-read-model";
import {
    readGlobalAssetProductReadModel,
    selectCanonicalSafeFieldProductSurfaceSource,
    type CanonicalSafeFieldSelection,
} from "./parqet/global-assets/product-surface-selectors";
import { aggregateAssetValueTotals } from "./calculations/view-model-aggregates";
import { buildGlobalAssetViewModelsFromProductReadModel } from "./view-models/global-asset-view-model-builder";

export function resolveGlobalAssetProductGuardEnabled(rawValue?: string): boolean {
    const value = rawValue ?? process.env.NEXT_PUBLIC_GLOBAL_ASSET_PRODUCT_GUARD_ENABLED;

    if (!value || value.trim().length === 0) {
        return true;
    }

    const normalizedValue = value.trim().toLowerCase();

    if (normalizedValue === "0" || normalizedValue === "false" || normalizedValue === "off") {
        return false;
    }

    if (normalizedValue === "1" || normalizedValue === "true" || normalizedValue === "on") {
        return true;
    }

    return true;
}

/**
 * Baut die zentralen Dashboard-Kennzahlen aus aktiven und geschlossenen Assets.
 *
 * Die Summen werden ueber beide Listen berechnet, damit die Gesamtsicht
 * konsistent bleibt.
 */
export function buildDashboardStats(params: {
    activeAssets: GlobalAssetViewModel[];
    closedAssets: GlobalAssetViewModel[];
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

    const totals = aggregateAssetValueTotals(allAssets);

    return {
        rawActivityCount,
        filteredActivityCount,
        assetCount,
        activeAssetCount,
        closedAssetCount,
        totalDividendNet: totals.totalDividendNet,
        totalPositionValue: totals.totalPositionValue,
        totalUnrealizedPnL: totals.totalUnrealizedPnL,
    };
}

/**
 * Sortiert aktive Assets primär nach Positionswert, sekundär nach letzter Aktivitaet.
 *
 * Das entspricht der gewohnten Priorisierung im Dashboard:
 * grosse Positionen zuerst.
 */
export function sortActiveAssets(assets: GlobalAssetViewModel[]): GlobalAssetViewModel[] {
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
export function sortClosedAssets(assets: GlobalAssetViewModel[]): GlobalAssetViewModel[] {
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

export type CanonicalDashboardSafeFieldSelection = {
    selection: CanonicalSafeFieldSelection;
    /**
     * Selected asset surface.
     * - `global_asset_product` => canonical Product Read Model projection
     * - `runtime_assets_fallback` => already-loaded runtime data used only as fallback state
     */
    assets: GlobalAssetViewModel[];
};

export function selectCanonicalDashboardSafeFieldSource(input: {
    runtimeFallbackAssets: GlobalAssetViewModel[];
    productReadModel?: unknown;
    guardEnabled: boolean;
}): CanonicalDashboardSafeFieldSelection {
    const productReadModel = readGlobalAssetProductReadModel(input.productReadModel);
    const selection = selectCanonicalSafeFieldProductSurfaceSource({
        surface: "dashboard",
        runtimeFallbackAssets: input.runtimeFallbackAssets,
        productReadModel: input.productReadModel,
        guardEnabled: input.guardEnabled,
    });

    if (selection.selectedSource === "global_asset_product" && productReadModel) {
        return {
            selection,
            assets: buildGlobalAssetViewModelsFromProductReadModel(productReadModel),
        };
    }

    return {
        selection,
        assets: input.runtimeFallbackAssets,
    };
}

export function selectCanonicalAssetTableSafeFieldSource(input: {
    runtimeFallbackAssets: GlobalAssetViewModel[];
    productReadModel?: unknown;
    guardEnabled: boolean;
}): CanonicalDashboardSafeFieldSelection {
    const productReadModel = readGlobalAssetProductReadModel(input.productReadModel);
    const selection = selectCanonicalSafeFieldProductSurfaceSource({
        surface: "asset_table",
        runtimeFallbackAssets: input.runtimeFallbackAssets,
        productReadModel: input.productReadModel,
        guardEnabled: input.guardEnabled,
    });

    if (selection.selectedSource === "global_asset_product" && productReadModel) {
        return {
            selection,
            assets: buildGlobalAssetViewModelsFromProductReadModel(productReadModel),
        };
    }

    return {
        selection,
        assets: input.runtimeFallbackAssets,
    };
}

export function selectCanonicalAssetDetailSafeFieldSource(input: {
    runtimeFallbackAssets: GlobalAssetViewModel[];
    productReadModel?: unknown;
    guardEnabled: boolean;
}): CanonicalDashboardSafeFieldSelection {
    const productReadModel = readGlobalAssetProductReadModel(input.productReadModel);
    const selection = selectCanonicalSafeFieldProductSurfaceSource({
        surface: "asset_detail",
        runtimeFallbackAssets: input.runtimeFallbackAssets,
        productReadModel: input.productReadModel,
        guardEnabled: input.guardEnabled,
    });

    if (selection.selectedSource === "global_asset_product" && productReadModel) {
        return {
            selection,
            assets: buildGlobalAssetViewModelsFromProductReadModel(productReadModel),
        };
    }

    return {
        selection,
        assets: input.runtimeFallbackAssets,
    };
}

export type GuardedDashboardSourceSelection = CanonicalDashboardSafeFieldSelection;

export function selectGuardedDashboardSource(input: {
    runtimeFallbackAssets: GlobalAssetViewModel[];
    productReadModel?: ProductReadModelAssets | null;
    guardEnabled: boolean;
}): GuardedDashboardSourceSelection {
    return selectCanonicalDashboardSafeFieldSource(input);
}

export function selectGuardedAssetTableSource(input: {
    runtimeFallbackAssets: GlobalAssetViewModel[];
    productReadModel?: ProductReadModelAssets | null;
    guardEnabled: boolean;
}): GuardedDashboardSourceSelection {
    return selectCanonicalAssetTableSafeFieldSource(input);
}

export function selectGuardedAssetDetailSource(input: {
    runtimeFallbackAssets: GlobalAssetViewModel[];
    productReadModel?: ProductReadModelAssets | null;
    guardEnabled: boolean;
}): GuardedDashboardSourceSelection {
    return selectCanonicalAssetDetailSafeFieldSource(input);
}

