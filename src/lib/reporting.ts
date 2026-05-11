import { getAssetDisplayName, scopeAssetMetrics } from "./asset-detail";
import { loadDashboardCache, type DashboardCache } from "./dashboard-cache";
import {
    loadKnownPortfolios,
    loadPortfolioScope,
    resolvePortfolioScope,
} from "./app-settings";
import type { AssetSummary, ReconciliationWarning } from "./types";

export type ReportAssetRow = {
    name: string;
    isin: string;
    status: "Aktiv" | "Geschlossen" | "Nicht verfügbar";
    portfolios: string;
    netShares: number | null;
    positionValue: number | null;
    unrealizedPnL: number | null;
    totalDividendNet: number | null;
    latestActivityAt: string | null;
};

export type ReportBreakdownRow = {
    portfolioName: string;
    activeAssets: number;
    closedAssets: number;
    positionValue: number | null;
    unrealizedPnL: number | null;
    totalDividendNet: number;
};

export type ReportQualitySummary = {
    consistencyAssets: number;
    consistencyMessages: number;
    reconciliationInfo: number;
    reconciliationReview: number;
    reconciliationCritical: number;
    totalWarnings: number;
    label: "Keine Hinweise" | "Hinweis" | "Prüfen" | "Eingeschränkt";
};

export type LocalReportModel = {
    cache: DashboardCache;
    selectedPortfolioIds: string[];
    scopeLabel: string;
    hasScopeMismatch: boolean;
    generatedAt: string | null;
    assets: ReportAssetRow[];
    breakdown: ReportBreakdownRow[];
    quality: ReportQualitySummary;
    totals: {
        totalPositionValue: number | null;
        totalUnrealizedPnL: number | null;
        totalDividendNet: number;
        activeAssets: number;
        closedAssets: number;
    };
};

function unique(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
}

function sameSelection(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false;

    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();

    return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function summarizeQuality(cache: DashboardCache): ReportQualitySummary {
    const consistencyAssets = cache.consistencyReport?.assetsWithWarnings.length ?? 0;
    const consistencyMessages =
        cache.consistencyReport?.assetsWithWarnings.reduce(
            (sum, item) => sum + item.warnings.length,
            0
        ) ?? 0;

    const reconciliationInfo = cache.reconciliationWarnings.filter(
        (warning) => warning.severity === "info"
    ).length;
    const reconciliationReview = cache.reconciliationWarnings.filter(
        (warning) => warning.severity === "warning"
    ).length;
    const reconciliationCritical = cache.reconciliationWarnings.filter(
        (warning) => warning.severity === "error"
    ).length;
    const totalWarnings = consistencyMessages + cache.reconciliationWarnings.length;

    return {
        consistencyAssets,
        consistencyMessages,
        reconciliationInfo,
        reconciliationReview,
        reconciliationCritical,
        totalWarnings,
        label:
            reconciliationCritical > 0
                ? "Eingeschränkt"
                : consistencyMessages > 0 || reconciliationReview > 0
                  ? "Prüfen"
                  : totalWarnings > 0
                    ? "Hinweis"
                    : "Keine Hinweise",
    };
}

function toReportRows(
    assets: AssetSummary[],
    selectedPortfolioIds: string[]
): ReportAssetRow[] {
    return assets
        .map((asset) => {
            const metrics = scopeAssetMetrics(asset, selectedPortfolioIds);

            if (metrics.portfolioBreakdown.length === 0) {
                return null;
            }

            const row: ReportAssetRow = {
                name: getAssetDisplayName(asset),
                isin: asset.isin,
                status:
                    metrics.netShares > 0
                        ? "Aktiv"
                        : metrics.netShares === 0
                          ? "Geschlossen"
                          : "Nicht verfügbar",
                portfolios: unique(
                    metrics.portfolioBreakdown.map((entry) => entry.portfolioName)
                ).join(", "),
                netShares: metrics.netShares,
                positionValue: metrics.positionValue,
                unrealizedPnL: metrics.unrealizedPnL,
                totalDividendNet: metrics.totalDividendNet,
                latestActivityAt: asset.latestActivityAt,
            };

            return row;
        })
        .filter((row): row is ReportAssetRow => row !== null);
}

function buildBreakdown(
    assets: AssetSummary[],
    selectedPortfolioIds: string[]
): ReportBreakdownRow[] {
    const selectedIds = new Set(selectedPortfolioIds);
    const hasManualScope = selectedIds.size > 0;
    const byPortfolio = new Map<string, ReportBreakdownRow>();

    for (const asset of assets) {
        for (const entry of asset.portfolioBreakdown) {
            if (hasManualScope && !selectedIds.has(entry.portfolioId)) {
                continue;
            }

            const current = byPortfolio.get(entry.portfolioName) ?? {
                portfolioName: entry.portfolioName,
                activeAssets: 0,
                closedAssets: 0,
                positionValue: 0,
                unrealizedPnL: 0,
                totalDividendNet: 0,
            };

            if (entry.netShares > 0) current.activeAssets += 1;
            if (entry.netShares === 0) current.closedAssets += 1;
            current.positionValue = (current.positionValue ?? 0) + (entry.positionValue ?? 0);
            current.unrealizedPnL = (current.unrealizedPnL ?? 0) + (entry.unrealizedPnL ?? 0);
            current.totalDividendNet += entry.totalDividendNet;
            byPortfolio.set(entry.portfolioName, current);
        }
    }

    return Array.from(byPortfolio.values()).sort((a, b) =>
        a.portfolioName.localeCompare(b.portfolioName, "de-DE")
    );
}

export function loadLocalReportModel(): LocalReportModel | null {
    const cache = loadDashboardCache();

    if (!cache) {
        return null;
    }

    const knownPortfolios = loadKnownPortfolios();
    const scope = loadPortfolioScope();
    const resolvedScope = resolvePortfolioScope(scope, knownPortfolios);
    const selectedPortfolioIds =
        resolvedScope.selectedPortfolioIds.length > 0
            ? resolvedScope.selectedPortfolioIds
            : cache.selectedPortfolioIds;
    const allRows = toReportRows(
        [...cache.activeAssets, ...cache.closedAssets],
        selectedPortfolioIds
    );
    const activeAssets = allRows.filter((row) => row.status === "Aktiv").length;
    const closedAssets = allRows.filter((row) => row.status === "Geschlossen").length;
    const hasPositionValues = allRows.some((row) => row.positionValue != null);
    const hasPnlValues = allRows.some((row) => row.unrealizedPnL != null);

    return {
        cache,
        selectedPortfolioIds,
        scopeLabel:
            scope.mode === "manual"
                ? `${selectedPortfolioIds.length} Portfolio${selectedPortfolioIds.length === 1 ? "" : "s"} im globalen Scope`
                : "Alle lokal bekannten Portfolios im globalen Scope",
        hasScopeMismatch: !sameSelection(selectedPortfolioIds, cache.selectedPortfolioIds),
        generatedAt: cache.lastUpdatedAt ?? cache.generatedAt,
        assets: allRows,
        breakdown: buildBreakdown([...cache.activeAssets, ...cache.closedAssets], selectedPortfolioIds),
        quality: summarizeQuality(cache),
        totals: {
            totalPositionValue: hasPositionValues
                ? allRows.reduce((sum, row) => sum + (row.positionValue ?? 0), 0)
                : null,
            totalUnrealizedPnL: hasPnlValues
                ? allRows.reduce((sum, row) => sum + (row.unrealizedPnL ?? 0), 0)
                : null,
            totalDividendNet: allRows.reduce(
                (sum, row) => sum + (row.totalDividendNet ?? 0),
                0
            ),
            activeAssets,
            closedAssets,
        },
    };
}

export function mapSeverityLabel(
    warning: Pick<ReconciliationWarning, "severity">
): "Hinweis" | "Prüfen" | "Eingeschränkt" {
    if (warning.severity === "error") return "Eingeschränkt";
    if (warning.severity === "warning") return "Prüfen";
    return "Hinweis";
}
