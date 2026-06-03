import type {
    GlobalAssetViewModel,
    ConsistencyReport,
    PortfolioPosition,
    ReconciliationWarning,
} from "./types";
import { getAssetDisplayName as resolveAssetDisplayName } from "./asset-display";
import { scopeAssetAggregationToPortfolioSelection } from "./calculations/view-model-aggregates";
import {
    resolveGlobalAssetProductGuardEnabled,
    selectCanonicalAssetDetailSafeFieldSource,
} from "./dashboard-helpers";
import {
    loadKnownPortfolios,
    loadPortfolioScope,
    resolvePortfolioScope,
} from "./app-settings";

export type AssetDetailWarning = {
    label: "Hinweis" | "Prüfen" | "Eingeschränkt";
    message: string;
    source: string;
    occurredAt?: string | null;
};

export type ScopedAssetMetrics = {
    portfolioBreakdown: PortfolioPosition[];
    portfolioCount: number;
    netShares: number;
    remainingCostBasis: number;
    avgBuyPrice: number | null;
    positionValue: number | null;
    unrealizedPnL: number | null;
    totalDividendNet: number;
    latestTradePrice: number | null;
    marketPrice: number | null;
};

export type SelectedAssetScope = {
    mode: "all" | "manual";
    selectedAssetPortfolioIds: string[];
};

export type CanonicalAssetDetailSelection = {
    asset: GlobalAssetViewModel | null;
    assetSource: "global_asset_product" | "runtime_assets_fallback" | "missing";
    selectedAssets: GlobalAssetViewModel[];
    selection: ReturnType<typeof selectCanonicalAssetDetailSafeFieldSource>["selection"];
};

function normalizeAssetKey(value: string | null | undefined): string {
    return value?.trim().toUpperCase() ?? "";
}

function createReadableSlug(label: string): string {
    return label
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

function uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

export function getAssetDetailKey(asset: Pick<GlobalAssetViewModel, "isin">): string {
    return normalizeAssetKey(asset.isin);
}

export function getAssetDisplayName(asset: GlobalAssetViewModel): string {
    return resolveAssetDisplayName(asset);
}

export function getAssetLogoUrl(asset: GlobalAssetViewModel): string | null {
    const candidates = [
        asset.metadata as Record<string, unknown> | undefined,
        asset.externalMetadata as Record<string, unknown> | undefined,
        asset.assetMeta as Record<string, unknown> | undefined,
    ];

    for (const candidate of candidates) {
        const value = candidate?.logoUrl;
        if (typeof value === "string" && value.trim().length > 0) {
            return value;
        }
    }

    return null;
}

export function getAssetInitials(asset: GlobalAssetViewModel): string {
    const label = getAssetDisplayName(asset).trim();

    if (!label) {
        return asset.isin.slice(0, 2).toUpperCase();
    }

    const words = label.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
        return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
    }

    return label.slice(0, 2).toUpperCase();
}

export function createAssetSlug(asset: GlobalAssetViewModel): string {
    const label = createReadableSlug(getAssetDisplayName(asset));

    return label || asset.isin.toLowerCase();
}

export function createAssetDetailHref(asset: GlobalAssetViewModel): string | null {
    const key = getAssetDetailKey(asset);

    if (!key) {
        return null;
    }

    return `/assets/${createAssetSlug(asset)}?id=${encodeURIComponent(key)}`;
}

export function createAssetDetailHrefFromParts(input: {
    stableKey: string | null | undefined;
    label: string | null | undefined;
}): string | null {
    const key = normalizeAssetKey(input.stableKey);

    if (!key) {
        return null;
    }

    const slug = createReadableSlug(input.label ?? "") || key.toLowerCase();

    return `/assets/${slug}?id=${encodeURIComponent(key)}`;
}

export function findAssetByKey(assets: GlobalAssetViewModel[], key: string): GlobalAssetViewModel | null {
    const normalizedKey = normalizeAssetKey(key);

    if (!normalizedKey) {
        return null;
    }

    return assets.find((asset) => normalizeAssetKey(asset.isin) === normalizedKey) ?? null;
}

export function selectCanonicalAssetDetailAsset(input: {
    assetKey: string;
    runtimeFallbackAssets: GlobalAssetViewModel[];
    productReadModel?: unknown;
    guardEnabled?: boolean;
}): CanonicalAssetDetailSelection {
    const guardEnabled = resolveGlobalAssetProductGuardEnabled(
        input.guardEnabled == null ? undefined : String(input.guardEnabled),
    );
    const selected = selectCanonicalAssetDetailSafeFieldSource({
        runtimeFallbackAssets: input.runtimeFallbackAssets,
        productReadModel: input.productReadModel,
        guardEnabled,
    });
    const selectedAsset = findAssetByKey(selected.assets, input.assetKey);

    if (selectedAsset) {
        return {
            asset: selectedAsset,
            assetSource: selected.selection.selectedSource,
            selectedAssets: selected.assets,
            selection: selected.selection,
        };
    }

    const runtimeFallbackAsset = findAssetByKey(
        input.runtimeFallbackAssets,
        input.assetKey,
    );

    return {
        asset: runtimeFallbackAsset,
        assetSource: runtimeFallbackAsset ? "runtime_assets_fallback" : "missing",
        selectedAssets: runtimeFallbackAsset ? input.runtimeFallbackAssets : selected.assets,
        selection: selected.selection,
    };
}

export function scopeAssetMetrics(
    asset: GlobalAssetViewModel,
    selectedPortfolioIds: string[]
): ScopedAssetMetrics {
    const scoped = scopeAssetAggregationToPortfolioSelection(
        asset,
        selectedPortfolioIds
    );

    if (!scoped) {
        return {
            portfolioBreakdown: [],
            portfolioCount: 0,
            netShares: 0,
            remainingCostBasis: 0,
            avgBuyPrice: null,
            positionValue: null,
            unrealizedPnL: null,
            totalDividendNet: 0,
            latestTradePrice: asset.latestTradePrice,
            marketPrice: asset.marketPrice,
        };
    }

    return {
        portfolioBreakdown: scoped.portfolioBreakdown,
        portfolioCount: scoped.portfolioBreakdown.length,
        netShares: scoped.netShares,
        remainingCostBasis: scoped.remainingCostBasis,
        avgBuyPrice: scoped.avgBuyPrice,
        positionValue: scoped.positionValue,
        unrealizedPnL: scoped.unrealizedPnL,
        totalDividendNet: scoped.totalDividendNet,
        latestTradePrice: scoped.latestTradePrice,
        marketPrice: scoped.marketPrice,
    };
}

export function resolveSelectedAssetScope(asset: GlobalAssetViewModel): SelectedAssetScope {
    const currentScope = loadPortfolioScope();
    const knownPortfolios = loadKnownPortfolios();
    const assetAvailableIds = uniqueIds([
        ...asset.portfolioBreakdown.map((entry) => entry.portfolioId),
        ...asset.portfolioIds,
    ]);
    const assetAvailableIdSet = new Set(assetAvailableIds);

    if (currentScope.mode === "all") {
        if (knownPortfolios.length > 0) {
            const globalScope = resolvePortfolioScope(currentScope, knownPortfolios);
            const intersection = globalScope.selectedPortfolioIds.filter((id) =>
                assetAvailableIdSet.has(id)
            );
            return {
                mode: "all",
                selectedAssetPortfolioIds:
                    intersection.length > 0 ? intersection : assetAvailableIds,
            };
        }

        return { mode: "all", selectedAssetPortfolioIds: assetAvailableIds };
    }

    const selectedManualIds =
        knownPortfolios.length > 0
            ? resolvePortfolioScope(currentScope, knownPortfolios).selectedPortfolioIds
            : uniqueIds(currentScope.selectedPortfolioIds);

    return {
        mode: "manual",
        selectedAssetPortfolioIds: selectedManualIds.filter((id) =>
            assetAvailableIdSet.has(id)
        ),
    };
}

export function getAssetStatusLabel(
    metrics: Pick<ScopedAssetMetrics, "netShares" | "portfolioCount">
): string {
    if (metrics.portfolioCount === 0) {
        return "unklar";
    }

    if (metrics.netShares > 0) {
        return "aktiv";
    }

    if (metrics.netShares === 0) {
        return "geschlossen";
    }

    return "unklar";
}

export function getAssetWarnings(params: {
    asset: GlobalAssetViewModel;
    consistencyReport: ConsistencyReport | null;
    reconciliationWarnings: ReconciliationWarning[];
}): AssetDetailWarning[] {
    const key = getAssetDetailKey(params.asset);
    const consistencyWarnings: AssetDetailWarning[] =
        params.consistencyReport?.assetsWithWarnings
            .filter((item) => normalizeAssetKey(item.isin) === key)
            .flatMap((item) =>
                item.warnings.map((message) => ({
                    label: "Prüfen" as const,
                    message,
                    source: "Konsistenzprüfung",
                }))
            ) ?? [];
    const reconciliationWarnings = params.reconciliationWarnings
        .filter((warning) => normalizeAssetKey(warning.isin) === key)
        .map((warning) => ({
            label:
                warning.severity === "error"
                    ? "Eingeschränkt" as const
                    : warning.severity === "warning"
                      ? "Prüfen" as const
                      : "Hinweis" as const,
            message: warning.message,
            source: warning.source === "override" ? "Override-Prüfung" : "Abgleich",
            occurredAt: warning.lastChangedAt ?? null,
        }));

    return [...consistencyWarnings, ...reconciliationWarnings];
}

