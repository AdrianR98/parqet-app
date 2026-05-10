import type {
    AssetSummary,
    ConsistencyReport,
    PortfolioPosition,
    ReconciliationWarning,
} from "./types";

export type AssetDetailWarning = {
    label: "Hinweis" | "Prüfung nötig" | "Kritisch";
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

export function getAssetDetailKey(asset: Pick<AssetSummary, "isin">): string {
    return normalizeAssetKey(asset.isin);
}

export function getAssetDisplayName(asset: AssetSummary): string {
    return (
        asset.name ??
        asset.assetName ??
        asset.displayName ??
        asset.title ??
        asset.symbol ??
        asset.ticker ??
        asset.tickerSymbol ??
        asset.wkn ??
        asset.isin
    );
}

export function getAssetLogoUrl(asset: AssetSummary): string | null {
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

export function getAssetInitials(asset: AssetSummary): string {
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

export function createAssetSlug(asset: AssetSummary): string {
    const label = createReadableSlug(getAssetDisplayName(asset));

    return label || asset.isin.toLowerCase();
}

export function createAssetDetailHref(asset: AssetSummary): string | null {
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

export function findAssetByKey(assets: AssetSummary[], key: string): AssetSummary | null {
    const normalizedKey = normalizeAssetKey(key);

    if (!normalizedKey) {
        return null;
    }

    return assets.find((asset) => normalizeAssetKey(asset.isin) === normalizedKey) ?? null;
}

export function scopeAssetMetrics(
    asset: AssetSummary,
    selectedPortfolioIds: string[]
): ScopedAssetMetrics {
    const selectedIds = new Set(selectedPortfolioIds);
    const hasManualScope = selectedIds.size > 0;
    const portfolioBreakdown = asset.portfolioBreakdown.filter((entry) => {
        return !hasManualScope || selectedIds.has(entry.portfolioId);
    });

    if (portfolioBreakdown.length === asset.portfolioBreakdown.length) {
        return {
            portfolioBreakdown,
            portfolioCount: portfolioBreakdown.length,
            netShares: asset.netShares,
            remainingCostBasis: asset.remainingCostBasis,
            avgBuyPrice: asset.avgBuyPrice,
            positionValue: asset.positionValue,
            unrealizedPnL: asset.unrealizedPnL,
            totalDividendNet: asset.totalDividendNet,
            latestTradePrice: asset.latestTradePrice,
            marketPrice: asset.marketPrice,
        };
    }

    const netShares = portfolioBreakdown.reduce((sum, entry) => sum + entry.netShares, 0);
    const remainingCostBasis = portfolioBreakdown.reduce(
        (sum, entry) => sum + entry.remainingCostBasis,
        0
    );
    const positionValue = portfolioBreakdown.reduce((sum, entry) => {
        return entry.positionValue == null ? sum : sum + entry.positionValue;
    }, 0);
    const unrealizedPnL = portfolioBreakdown.reduce((sum, entry) => {
        return entry.unrealizedPnL == null ? sum : sum + entry.unrealizedPnL;
    }, 0);
    const totalDividendNet = portfolioBreakdown.reduce(
        (sum, entry) => sum + entry.totalDividendNet,
        0
    );

    return {
        portfolioBreakdown,
        portfolioCount: portfolioBreakdown.length,
        netShares,
        remainingCostBasis,
        avgBuyPrice: netShares > 0 ? remainingCostBasis / netShares : null,
        positionValue: portfolioBreakdown.some((entry) => entry.positionValue != null)
            ? positionValue
            : null,
        unrealizedPnL: portfolioBreakdown.some((entry) => entry.unrealizedPnL != null)
            ? unrealizedPnL
            : null,
        totalDividendNet,
        latestTradePrice: asset.latestTradePrice,
        marketPrice: asset.marketPrice,
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
    asset: AssetSummary;
    consistencyReport: ConsistencyReport | null;
    reconciliationWarnings: ReconciliationWarning[];
}): AssetDetailWarning[] {
    const key = getAssetDetailKey(params.asset);
    const consistencyWarnings: AssetDetailWarning[] =
        params.consistencyReport?.assetsWithWarnings
            .filter((item) => normalizeAssetKey(item.isin) === key)
            .flatMap((item) =>
                item.warnings.map((message) => ({
                    label: "Prüfung nötig" as const,
                    message,
                    source: "Konsistenzprüfung",
                }))
            ) ?? [];
    const reconciliationWarnings = params.reconciliationWarnings
        .filter((warning) => normalizeAssetKey(warning.isin) === key)
        .map((warning) => ({
            label:
                warning.severity === "error"
                    ? "Kritisch" as const
                    : warning.severity === "warning"
                      ? "Prüfung nötig" as const
                      : "Hinweis" as const,
            message: warning.message,
            source: warning.source === "override" ? "Override-Prüfung" : "Reconciliation",
            occurredAt: warning.lastChangedAt ?? null,
        }));

    return [...consistencyWarnings, ...reconciliationWarnings];
}
