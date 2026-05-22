"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
    loadAssetDetailTimeRange,
    loadKnownPortfolios,
    loadPortfolioScope,
    resolvePortfolioScope,
    saveAssetDetailTimeRange,
    subscribeToLocalSettings,
} from "../../../lib/app-settings";
import { loadDashboardCache } from "../../../lib/dashboard-cache";
import {
    findAssetByKey,
    getAssetDetailKey,
    getAssetDisplayName,
    getAssetStatusLabel,
    getAssetWarnings,
    scopeAssetMetrics,
} from "../../../lib/asset-detail";
import { enrichAssetsWithMetadata } from "../../../lib/asset-metadata";
import { getActivityTypeLabel, normalizeExactIsin } from "../../../lib/local-activity-read-model";
import { formatCurrency, formatShares } from "../../../lib/format";
import { getAssetInitials, getAssetResolvedLogoUrl } from "../../../lib/asset-display";
import type { ActivitiesAuditItem, AssetSummary, PortfolioPosition } from "../../../lib/types";
import styles from "./AssetDetailPage.module.css";

const MONTH_FORMATTER = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });
const CHART_MONTHS = 12;
const CHART_HEIGHT_PX = 230;
const DETAIL_RANGE_OPTIONS = [
    { key: "1y", label: "1 Jahr", months: 12 },
    { key: "3y", label: "3 Jahre", months: 36 },
    { key: "5y", label: "5 Jahre", months: 60 },
    { key: "10y", label: "10 Jahre", months: 120 },
    { key: "max", label: "Max", months: null },
] as const;

type DetailRangeKey = (typeof DETAIL_RANGE_OPTIONS)[number]["key"];

function uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

type SelectedAssetScope = {
    mode: "all" | "manual";
    selectedAssetPortfolioIds: string[];
};

function resolveSelectedAssetScope(asset: AssetSummary): SelectedAssetScope {
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
            const intersection = globalScope.selectedPortfolioIds.filter((id) => assetAvailableIdSet.has(id));
            return {
                mode: "all",
                selectedAssetPortfolioIds: intersection.length > 0 ? intersection : assetAvailableIds,
            };
        }

        return { mode: "all", selectedAssetPortfolioIds: assetAvailableIds };
    }

    const selectedManualIds = knownPortfolios.length > 0
        ? resolvePortfolioScope(currentScope, knownPortfolios).selectedPortfolioIds
        : uniqueIds(currentScope.selectedPortfolioIds);

    return {
        mode: "manual",
        selectedAssetPortfolioIds: selectedManualIds.filter((id) => assetAvailableIdSet.has(id)),
    };
}

function subscribeToLocalAssetState(onStoreChange: () => void) {
    return subscribeToLocalSettings(onStoreChange);
}

function getLocalAssetStateSnapshot(): string {
    const scope = loadPortfolioScope();
    const cache = loadDashboardCache();
    return JSON.stringify({
        scope,
        cacheUpdatedAt: cache?.lastUpdatedAt ?? cache?.generatedAt ?? null,
        cacheSelection: cache?.selectedPortfolioIds ?? [],
        activityItemCount: cache?.activityItems?.length ?? 0,
        activeAssetCount: cache?.activeAssets?.length ?? 0,
        closedAssetCount: cache?.closedAssets?.length ?? 0,
    });
}

function PortfolioBreakdown({ entries }: { entries: PortfolioPosition[] }) {
    if (entries.length === 0) {
        return <div className={styles.inlineEmpty}>Keine Portfolio-Anteile im aktuell ausgewählten Scope.</div>;
    }

    return (
        <div className={styles.breakdownList}>
            {entries.map((entry) => (
                <div key={entry.portfolioId} className={styles.breakdownRow}>
                    <span className={styles.breakdownName}>{entry.portfolioName}</span>
                    <span>{formatShares(entry.netShares)}</span>
                    <span>{formatCurrency(entry.positionValue)}</span>
                </div>
            ))}
        </div>
    );
}

type DividendMonthSegment = {
    portfolioId: string;
    portfolioName: string;
    value: number;
    payments: number;
};

type DividendMonthSlot = {
    key: string;
    monthStart: Date;
    label: string;
    total: number;
    payments: number;
    segments: DividendMonthSegment[];
};

type DividendPortfolio = {
    id: string;
    label: string;
    color: string;
    total: number;
};

type DividendAnalysis = {
    total: number;
    paymentCount: number;
    ttmYield: number | null;
    cagr5: number | null;
    cagr10: number | null;
    hasAnyScopedDividendRows: boolean;
    hasAnyValidScopedDividendRows: boolean;
    monthSlots: DividendMonthSlot[];
    portfolios: DividendPortfolio[];
    maxValue: number;
    yTicks: number[];
};

type ActiveDividendTooltip = {
    monthKey: string;
    portfolioId: string;
    monthLabel: string;
    portfolioName: string;
    segmentValue: number;
    monthTotal: number;
    paymentCount: number;
    leftPercent: number;
    topPx: number;
};

type KpiHelpProps = {
    label: string;
    value: string;
    helpText: string;
};

function DividendKpiCard({ label, value, helpText }: KpiHelpProps) {
    return (
        <div className={styles.kpiCard}>
            <div className={styles.kpiHelpWrap}>
                <button
                    type="button"
                    className={styles.kpiHelpButton}
                    aria-label="Berechnung erklären"
                >
                    ?
                </button>
                <div className={styles.kpiHelpTooltip} role="tooltip">
                    {helpText}
                </div>
            </div>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function monthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
    return MONTH_FORMATTER.format(date).replace(/\.$/, "");
}

function parsePositiveDividendAmount(activity: ActivitiesAuditItem): number | null {
    const candidates: unknown[] = [
        activity.amountNet,
        activity.amount,
        (activity as { value?: unknown }).value,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
            return candidate;
        }
    }

    return null;
}

function parseValidDividendDate(activity: ActivitiesAuditItem): Date | null {
    const parsed = new Date(activity.datetime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function computeCagr(yearlySums: Map<number, number>, years: number): number | null {
    if (yearlySums.size < years + 1) {
        return null;
    }

    const yearsSorted = Array.from(yearlySums.keys()).sort((a, b) => a - b);
    const endYear = yearsSorted[yearsSorted.length - 1];
    const startYear = endYear - years;

    if (!yearlySums.has(startYear) || !yearlySums.has(endYear)) {
        return null;
    }

    const start = yearlySums.get(startYear) ?? 0;
    const end = yearlySums.get(endYear) ?? 0;

    if (start <= 0 || end <= 0) {
        return null;
    }

    return Math.pow(end / start, 1 / years) - 1;
}

function monthDiffInclusive(start: Date, end: Date): number {
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

function resolveAxisMode(range: DetailRangeKey, spanMonths: number): "monthYear" | "year" {
    if (range === "1y" || range === "3y") {
        return "monthYear";
    }

    if (range === "max") {
        return spanMonths <= 60 ? "year" : "year";
    }

    return "year";
}

function shouldShowMonthLabel(
    index: number,
    total: number,
    range: DetailRangeKey,
    date: Date,
    previousDate: Date | null,
    spanMonths: number,
): boolean {
    if (index === 0 || index === total - 1) {
        return true;
    }

    if (range === "1y") {
        return true;
    }

    if (range === "3y") {
        const step = total > 20 ? 3 : 2;
        return index % step === 0;
    }

    if (range === "5y") {
        return Boolean(previousDate && date.getFullYear() !== previousDate.getFullYear());
    }

    if (range === "10y") {
        return Boolean(previousDate && date.getFullYear() !== previousDate.getFullYear());
    }

    if (range === "max") {
        const isLongMax = spanMonths > 60;
        if (!previousDate) return true;
        if (date.getFullYear() !== previousDate.getFullYear()) {
            return true;
        }

        if (!isLongMax) {
            const step = total > 24 ? 3 : 2;
            return index % step === 0;
        }

        return false;
    }

    return false;
}

function formatAxisLabel(date: Date, mode: "monthYear" | "year"): string {
    if (mode === "monthYear") {
        return date.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }).replace(/\.$/, "");
    }

    return date.toLocaleDateString("de-DE", { year: "numeric" });
}

function buildNiceTicks(maxValue: number): { maxRounded: number; ticks: number[] } {
    if (!(maxValue > 0)) {
        return { maxRounded: 0, ticks: [0] };
    }

    const roughStep = maxValue / 4;
    const candidateSteps = [0.5, 1, 2, 5, 10, 20, 50, 100];
    const step = candidateSteps.find((candidate) => candidate >= roughStep) ?? candidateSteps[candidateSteps.length - 1];
    const maxRounded = Math.ceil(maxValue / step) * step;
    const ticks = Array.from({ length: 5 }, (_, idx) => Number((idx * step).toFixed(2))).filter((tick) => tick <= maxRounded);

    if (ticks[ticks.length - 1] !== maxRounded) {
        ticks.push(maxRounded);
    }

    return { maxRounded, ticks };
}

function buildDividendAnalysis(input: {
    dividendActivities: ActivitiesAuditItem[];
    scopedCostBasis: number | null;
    selectedRange: DetailRangeKey;
}): DividendAnalysis {
    const hasAnyScopedDividendRows = input.dividendActivities.length > 0;
    const validRows = input.dividendActivities
        .map((activity) => {
            const amount = parsePositiveDividendAmount(activity);
            const date = parseValidDividendDate(activity);
            if (!amount || !date) return null;

            return {
                amount,
                date,
                portfolioId: activity.portfolioId?.trim() || "unknown_portfolio",
                portfolioName: activity.portfolioName?.trim() || "Portfolio unbekannt",
            };
        })
        .filter((row): row is NonNullable<typeof row> => row != null);
    const hasAnyValidScopedDividendRows = validRows.length > 0;

    const yearlySums = validRows.reduce((acc, row) => {
        const year = row.date.getFullYear();
        acc.set(year, (acc.get(year) ?? 0) + row.amount);
        return acc;
    }, new Map<number, number>());

    const latestDate = validRows.reduce<Date | null>((latest, row) => {
        if (!latest) return row.date;
        return row.date > latest ? row.date : latest;
    }, null);

    let ttmSum = 0;
    if (latestDate) {
        const start = new Date(latestDate);
        start.setFullYear(start.getFullYear() - 1);
        ttmSum = validRows.reduce((sum, row) => (row.date > start && row.date <= latestDate ? sum + row.amount : sum), 0);
    }

    const ttmYield =
        input.scopedCostBasis != null && input.scopedCostBasis > 0
            ? ttmSum / input.scopedCostBasis
            : null;

    if (!latestDate) {
        const nowMonth = monthStart(new Date());
        const start = input.selectedRange === "max" ? nowMonth : addMonths(nowMonth, -((DETAIL_RANGE_OPTIONS.find((entry) => entry.key === input.selectedRange)?.months ?? CHART_MONTHS) - 1));
        const slots = monthDiffInclusive(start, nowMonth);
        const monthSlots = Array.from({ length: Math.max(1, slots) }, (_, idx) => {
            const date = addMonths(start, idx);
            return {
                key: monthKey(date),
                monthStart: date,
                label: monthLabel(date),
                total: 0,
                payments: 0,
                segments: [],
            } satisfies DividendMonthSlot;
        });

        return {
            total: 0,
            paymentCount: 0,
            ttmYield,
            cagr5: computeCagr(yearlySums, 5),
            cagr10: computeCagr(yearlySums, 10),
            hasAnyScopedDividendRows,
            hasAnyValidScopedDividendRows,
            monthSlots,
            portfolios: [],
            maxValue: 0,
            yTicks: [0],
        };
    }

    const earliestDate = validRows.reduce((earliest, row) => {
        if (!earliest) return row.date;
        return row.date < earliest ? row.date : earliest;
    }, latestDate as Date | null);
    const endMonth = monthStart(latestDate);
    const selectedRangeOption = DETAIL_RANGE_OPTIONS.find((entry) => entry.key === input.selectedRange);
    const selectedMonths = selectedRangeOption?.months ?? CHART_MONTHS;
    const startMonth = input.selectedRange === "max"
        ? monthStart(earliestDate ?? latestDate)
        : addMonths(endMonth, -((selectedMonths ?? CHART_MONTHS) - 1));
    const monthsInRange = monthDiffInclusive(startMonth, endMonth);
    const rangeRows = validRows.filter((row) => {
        const slotMonth = monthStart(row.date);
        return slotMonth >= startMonth && slotMonth <= endMonth;
    });
    const total = rangeRows.reduce((sum, row) => sum + row.amount, 0);
    const paymentCount = rangeRows.length;

    const monthly = new Map<string, { total: number; payments: number; byPortfolio: Map<string, { amount: number; payments: number; name: string }> }>();
    for (const row of rangeRows) {
        const slotMonth = monthStart(row.date);
        if (slotMonth < startMonth || slotMonth > endMonth) continue;

        const key = monthKey(slotMonth);
        const current = monthly.get(key) ?? {
            total: 0,
            payments: 0,
            byPortfolio: new Map<string, { amount: number; payments: number; name: string }>(),
        };

        const segment = current.byPortfolio.get(row.portfolioId) ?? {
            amount: 0,
            payments: 0,
            name: row.portfolioName,
        };

        current.total += row.amount;
        current.payments += 1;
        segment.amount += row.amount;
        segment.payments += 1;
        current.byPortfolio.set(row.portfolioId, segment);

        monthly.set(key, current);
    }

    const portfolioTotals = new Map<string, { total: number; name: string }>();
    for (const month of monthly.values()) {
        for (const [portfolioId, segment] of month.byPortfolio.entries()) {
            const current = portfolioTotals.get(portfolioId) ?? { total: 0, name: segment.name };
            current.total += segment.amount;
            portfolioTotals.set(portfolioId, current);
        }
    }

    const palette = [
        "#1f5f93",
        "#0f7a93",
        "#2f7f6b",
        "#3b6da8",
        "#4e5ea8",
        "#5e74a0",
        "#2f8d9f",
        "#4f7f59",
        "#7a6ca8",
        "#357196",
        "#4b8a86",
        "#6f7f99",
    ];

    const portfolios = Array.from(portfolioTotals.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .map(([id, entry], idx) => ({ id, label: entry.name, total: entry.total, color: palette[idx % palette.length] }));

    const monthSlotsAll: DividendMonthSlot[] = Array.from({ length: monthsInRange }, (_, idx) => {
        const date = addMonths(startMonth, idx);
        const key = monthKey(date);
        const bucket = monthly.get(key);
        const segments = bucket
            ? Array.from(bucket.byPortfolio.entries())
                .map(([portfolioId, val]) => ({
                    portfolioId,
                    portfolioName: val.name,
                    value: val.amount,
                    payments: val.payments,
                }))
                .sort((a, b) => b.value - a.value)
            : [];

        return {
            key,
            monthStart: date,
            label: monthLabel(date),
            total: bucket?.total ?? 0,
            payments: bucket?.payments ?? 0,
            segments,
        };
    });
    const shouldCompressEmptyMonths =
        input.selectedRange === "3y" || input.selectedRange === "5y" || input.selectedRange === "10y" || input.selectedRange === "max";
    const monthSlots = shouldCompressEmptyMonths
        ? monthSlotsAll.filter((slot) => slot.total > 0)
        : monthSlotsAll;

    const rawMaxValue = monthSlots.reduce((m, slot) => Math.max(m, slot.total), 0);
    const { maxRounded, ticks: yTicks } = buildNiceTicks(rawMaxValue);

    return {
        total,
        paymentCount,
        ttmYield,
        cagr5: computeCagr(yearlySums, 5),
        cagr10: computeCagr(yearlySums, 10),
        hasAnyScopedDividendRows,
        hasAnyValidScopedDividendRows,
        monthSlots,
        portfolios,
        maxValue: maxRounded,
        yTicks,
    };
}

function formatPercent(value: number | null): string {
    if (value == null || !Number.isFinite(value)) {
        return "—";
    }

    return `${(value * 100).toLocaleString("de-DE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
    })} %`;
}

function getActivityTypeTone(type: string): string {
    if (type === "buy") return styles.activityBuy;
    if (type === "sell") return styles.activitySell;
    if (type === "dividend") return styles.activityDividend;
    if (type === "transfer_in" || type === "transfer_out") return styles.activityTransfer;
    return styles.activityNeutral;
}

export default function AssetDetailPage() {
    const searchParams = useSearchParams();
    const assetKey = searchParams.get("id")?.trim() ?? "";
    const clientReady = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );
    const localStateSnapshot = useSyncExternalStore(
        subscribeToLocalAssetState,
        getLocalAssetStateSnapshot,
        () => JSON.stringify({ scope: { mode: "all", selectedPortfolioIds: [] }, cacheUpdatedAt: null }),
    );
    const [heatmapOpen, setHeatmapOpen] = useState(false);
    const [failedLogoIdentities, setFailedLogoIdentities] = useState<Record<string, true>>({});
    const [activeDividendTooltip, setActiveDividendTooltip] = useState<ActiveDividendTooltip | null>(null);
    const selectedRange = useSyncExternalStore<DetailRangeKey>(
        subscribeToLocalSettings,
        () => loadAssetDetailTimeRange(),
        () => "1y",
    );

    const viewModel = useMemo(() => {
        void localStateSnapshot;
        if (!clientReady || !assetKey) return null;
        const cache = loadDashboardCache();
        if (!cache) return null;

        const assets = enrichAssetsWithMetadata([...(cache.activeAssets ?? []), ...(cache.closedAssets ?? [])]);
        const asset = findAssetByKey(assets, assetKey);
        if (!asset) return null;

        const selectedAssetScope = resolveSelectedAssetScope(asset);
        const isManualEmptyScope = selectedAssetScope.mode === "manual" && selectedAssetScope.selectedAssetPortfolioIds.length === 0;
        const scopedMetrics = isManualEmptyScope
            ? {
                ...scopeAssetMetrics(asset, []),
                portfolioBreakdown: [],
                portfolioCount: 0,
                netShares: 0,
                remainingCostBasis: 0,
                avgBuyPrice: null,
                positionValue: 0,
                unrealizedPnL: 0,
                totalDividendNet: 0,
            }
            : scopeAssetMetrics(asset, selectedAssetScope.selectedAssetPortfolioIds);

        return {
            asset,
            metrics: scopedMetrics,
            warnings: getAssetWarnings({
                asset,
                consistencyReport: cache.consistencyReport ?? null,
                reconciliationWarnings: cache.reconciliationWarnings ?? [],
            }),
            lastUpdatedAt: cache.lastUpdatedAt ?? cache.generatedAt ?? null,
            selectedAssetPortfolioIds: selectedAssetScope.selectedAssetPortfolioIds,
            selectedScopeMode: selectedAssetScope.mode,
            isManualEmptyScope,
            activityItems: cache.activityItems ?? [],
        };
    }, [assetKey, clientReady, localStateSnapshot]);

    const logoResetIdentity = viewModel
        ? `${viewModel.asset.isin}|${getAssetResolvedLogoUrl(viewModel.asset) ?? ""}`
        : "";
    const logoFailed = Boolean(logoResetIdentity && failedLogoIdentities[logoResetIdentity]);

    if (!clientReady) {
        return (
            <main className={styles.page}>
                <section className={styles.stateBox}>
                    <strong>Lokaler Stand wird vorbereitet</strong>
                    <p>Asset-Daten werden aus dem lokalen Cache geladen.</p>
                </section>
            </main>
        );
    }

    if (!viewModel) {
        return (
            <main className={styles.page}>
                <section className={styles.stateBox}>
                    <strong>Asset nicht lokal verfügbar</strong>
                    <p>Bitte in der Übersicht Daten laden und dann erneut öffnen.</p>
                    <Link href="/dashboard" className="ui-btn ui-btn-secondary">Zurück zur Übersicht</Link>
                </section>
            </main>
        );
    }

    const { asset, metrics, warnings, lastUpdatedAt, selectedAssetPortfolioIds, selectedScopeMode, isManualEmptyScope, activityItems } = viewModel;
    const displayName = getAssetDisplayName(asset);
    const logoUrl = getAssetResolvedLogoUrl(asset);
    const normalizedAssetIsin = normalizeExactIsin(asset.isin);
    const statusLabel = getAssetStatusLabel(metrics);
    const scopedIds = new Set(selectedAssetPortfolioIds);

    const scopedAssetActivities = activityItems
        .filter((item) => normalizeExactIsin(item.isin) === normalizedAssetIsin)
        .filter((item) => {
            if (!item.portfolioId) return selectedScopeMode === "all";
            if (selectedScopeMode === "manual" && scopedIds.size === 0) return false;
            if (scopedIds.size === 0) return true;
            return scopedIds.has(item.portfolioId);
        })
        .sort((a, b) => b.datetime.localeCompare(a.datetime));

    const scopedDividendActivities = scopedAssetActivities.filter((item) => item.type === "dividend");
    const dividendAnalysis = buildDividendAnalysis({
        dividendActivities: scopedDividendActivities,
        scopedCostBasis: metrics.remainingCostBasis,
        selectedRange,
    });

    const hasScopedPosition = metrics.portfolioBreakdown.length > 0;
    const recentActivities = scopedAssetActivities.slice(0, 5);
    const noScopedAssetMessage = "Dieses Asset ist in den ausgewählten Portfolios nicht enthalten.";

    return (
        <main className={styles.page}>
            <div className={styles.breadcrumbRow}>
                <Link href="/dashboard" className="ui-btn ui-btn-ghost">← Übersicht</Link>
            </div>

            <section className={styles.headerCard}>
                <div className={styles.assetMark}>
                    {logoUrl && !logoFailed ? (
                        <img
                            src={logoUrl}
                            alt={`${displayName} Logo`}
                            width={46}
                            height={46}
                            onError={() => {
                                if (!logoResetIdentity) {
                                    return;
                                }

                                setFailedLogoIdentities((current) => {
                                    if (current[logoResetIdentity]) {
                                        return current;
                                    }

                                    return {
                                        ...current,
                                        [logoResetIdentity]: true,
                                    };
                                });
                            }}
                            loading="lazy"
                            decoding="async"
                        />
                    ) : <span>{getAssetInitials(asset)}</span>}
                </div>
                <div className={styles.headerText}>
                    <h1>{displayName}</h1>
                    <div className={styles.metaLine}>ISIN {asset.isin || getAssetDetailKey(asset)} · {statusLabel}</div>
                    <div className={styles.metaSubline}>Stand: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString("de-DE") : "unbekannt"}</div>
                </div>
            </section>

            {isManualEmptyScope ? <div className="ui-banner ui-banner-info">{noScopedAssetMessage}</div> : null}

            <section className={styles.analysisGrid}>
                <article className={`${styles.card} ${styles.chartCard}`}>
                    <div className={styles.cardHead}>
                        <h2>Performance & Verlauf</h2>
                        <div className={styles.rangeSelector} role="group" aria-label="Zeitraum auswählen">
                            {DETAIL_RANGE_OPTIONS.map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    className={`${styles.rangeButton} ${selectedRange === option.key ? styles.rangeButtonActive : ""}`}
                                    onClick={() => saveAssetDetailTimeRange(option.key)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className={styles.chartMissing}>
                        <strong>Historische Kursdaten fehlen</strong>
                        <p>Für Kurs-, Positionswert- und Performance-Verläufe fehlen historische Marktdaten.</p>
                    </div>
                </article>

                <article className={`${styles.card} ${styles.metricAnchor}`}>
                    <div className={styles.cardHead}><h2>Rendite & Kennzahlen</h2></div>
                    <div className={styles.metricGrid}>
                        <div className={styles.metricPrimary}><span>Positionswert</span><strong>{hasScopedPosition ? formatCurrency(metrics.positionValue) : "—"}</strong></div>
                        <div className={styles.metricPrimary}><span>Gewinn / Verlust</span><strong className={(metrics.unrealizedPnL ?? 0) >= 0 ? styles.positive : styles.negative}>{hasScopedPosition ? formatCurrency(metrics.unrealizedPnL) : "—"}</strong></div>
                        <div><span>Einstand</span><strong>{hasScopedPosition ? formatCurrency(metrics.remainingCostBasis) : "—"}</strong></div>
                        <div><span>Stückzahl</span><strong>{hasScopedPosition ? formatShares(metrics.netShares) : "—"}</strong></div>
                    </div>
                    {warnings.length > 0 ? (
                        <div className={styles.warningHint}>{warnings.length} Hinweis{warnings.length === 1 ? "" : "e"} verfügbar.</div>
                    ) : null}
                    <div className={styles.inlineSection}>
                        <h3>Portfolio-Aufteilung</h3>
                        {isManualEmptyScope ? (
                            <div className={styles.inlineEmpty}>{noScopedAssetMessage}</div>
                        ) : (
                            <>
                                <div className={styles.breakdownHeader}>
                                    <span>Portfolio</span>
                                    <span>Bestand</span>
                                    <span>Wert</span>
                                </div>
                                <PortfolioBreakdown entries={metrics.portfolioBreakdown} />
                            </>
                        )}
                    </div>
                </article>
            </section>

            <article className={`${styles.card} ${styles.prominentCard}`}>
                <div className={styles.cardHead}><h2>Dividendenanalyse</h2></div>
                <div className={styles.dividendSummary}>
                    <DividendKpiCard
                        label="Gesamtsumme im Zeitraum"
                        value={formatCurrency(dividendAnalysis.total)}
                        helpText="Summe aller lokalen Netto-Dividenden dieses Assets im gewählten Zeitraum und Portfolio-Scope. Ungültige oder nicht-positive Beträge werden ignoriert."
                    />
                    <DividendKpiCard
                        label="Zahlungen im Zeitraum"
                        value={String(dividendAnalysis.paymentCount)}
                        helpText="Anzahl der lokalen Dividendenzahlungen dieses Assets im gewählten Zeitraum und Portfolio-Scope. Gezählt werden nur gültige positive Dividendenbeträge."
                    />
                    <DividendKpiCard
                        label="Netto-Rendite (TTM)"
                        value={formatPercent(dividendAnalysis.ttmYield)}
                        helpText="Netto-Dividenden der letzten 12 Monate geteilt durch den aktuellen Einstand im ausgewählten Portfolio-Scope. Der Wert ist unabhängig vom gewählten Chart-Zeitraum."
                    />
                    <DividendKpiCard
                        label="CAGR 5 Jahre"
                        value={formatPercent(dividendAnalysis.cagr5)}
                        helpText="Durchschnittliches jährliches Wachstum der lokalen Netto-Dividenden über 5 Jahre. Wird nur berechnet, wenn ausreichend gültige Jahresdaten vorhanden sind."
                    />
                    <DividendKpiCard
                        label="CAGR 10 Jahre"
                        value={formatPercent(dividendAnalysis.cagr10)}
                        helpText="Durchschnittliches jährliches Wachstum der lokalen Netto-Dividenden über 10 Jahre. Wird nur berechnet, wenn ausreichend gültige Jahresdaten vorhanden sind."
                    />
                </div>

                {dividendAnalysis.monthSlots.length > 0 && dividendAnalysis.hasAnyValidScopedDividendRows && !isManualEmptyScope ? (
                    <div className={styles.dividendModule}>
                        <div className={styles.dividendLegend}>
                            {dividendAnalysis.portfolios.map((portfolio) => (
                                <div key={portfolio.id} className={styles.legendItem}>
                                    <span className={styles.legendSwatch} style={{ backgroundColor: portfolio.color }} />
                                    <span>{portfolio.label}</span>
                                </div>
                            ))}
                        </div>

                        <div className={styles.dividendChart} aria-label="Monatliche Dividenden nach Portfolio">
                            <div className={styles.dividendYAxis}>
                                {dividendAnalysis.yTicks.slice().reverse().map((tick) => (
                                    <span key={tick}>{formatCurrency(tick)}</span>
                                ))}
                            </div>

                            <div className={styles.dividendPlot}>
                                <div className={styles.dividendGridLines}>
                                    {dividendAnalysis.yTicks.map((tick) => {
                                        const ratio = dividendAnalysis.maxValue > 0 ? tick / dividendAnalysis.maxValue : 0;
                                        return <span key={`grid-${tick}`} className={styles.gridLine} style={{ bottom: `${ratio * 100}%` }} />;
                                    })}
                                </div>

                                <div className={styles.dividendBarsRow} style={{ gridTemplateColumns: `repeat(${dividendAnalysis.monthSlots.length}, minmax(0, 1fr))` }}>
                                    {dividendAnalysis.monthSlots.map((slot, monthIndex) => {
                                        let accumulated = 0;
                                        const previousSlot = monthIndex > 0 ? dividendAnalysis.monthSlots[monthIndex - 1] : null;
                                        const spanMonths = dividendAnalysis.monthSlots.length > 1
                                            ? monthDiffInclusive(dividendAnalysis.monthSlots[0].monthStart, dividendAnalysis.monthSlots[dividendAnalysis.monthSlots.length - 1].monthStart)
                                            : 1;
                                        const axisMode = resolveAxisMode(selectedRange, spanMonths);
                                        return (
                                            <div key={slot.key} className={styles.dividendBarItem}>
                                                <div className={styles.dividendBarTrack}>
                                                    {slot.segments.map((segment, segmentIndex) => {
                                                        const ratio = dividendAnalysis.maxValue > 0 ? segment.value / dividendAnalysis.maxValue : 0;
                                                        const height = ratio * 100;
                                                        const bottom = accumulated;
                                                        accumulated += height;
                                                        const color = dividendAnalysis.portfolios.find((entry) => entry.id === segment.portfolioId)?.color ?? "#7d93ad";
                                                        const isBottom = segmentIndex === 0;
                                                        const isTop = segmentIndex === slot.segments.length - 1;
                                                        const tooltipTop = Math.max(8, CHART_HEIGHT_PX - ((bottom + height / 2) / 100) * CHART_HEIGHT_PX);

                                                        return (
                                                            <button
                                                                key={`${slot.key}-${segment.portfolioId}`}
                                                                type="button"
                                                                className={`${styles.dividendBar} ${isBottom ? styles.dividendBarBottom : ""} ${isTop ? styles.dividendBarTop : ""}`}
                                                                style={{ height: `${height}%`, bottom: `${bottom}%`, background: color }}
                                                                onMouseEnter={() => setActiveDividendTooltip({
                                                                    monthKey: slot.key,
                                                                    portfolioId: segment.portfolioId,
                                                                    monthLabel: slot.label,
                                                                    portfolioName: segment.portfolioName,
                                                                    segmentValue: segment.value,
                                                                    monthTotal: slot.total,
                                                                    paymentCount: segment.payments,
                                                                    leftPercent: ((monthIndex + 0.5) / dividendAnalysis.monthSlots.length) * 100,
                                                                    topPx: tooltipTop,
                                                                })}
                                                                onMouseLeave={() => setActiveDividendTooltip((current) => current?.monthKey === slot.key && current.portfolioId === segment.portfolioId ? null : current)}
                                                                onFocus={() => setActiveDividendTooltip({
                                                                    monthKey: slot.key,
                                                                    portfolioId: segment.portfolioId,
                                                                    monthLabel: slot.label,
                                                                    portfolioName: segment.portfolioName,
                                                                    segmentValue: segment.value,
                                                                    monthTotal: slot.total,
                                                                    paymentCount: segment.payments,
                                                                    leftPercent: ((monthIndex + 0.5) / dividendAnalysis.monthSlots.length) * 100,
                                                                    topPx: tooltipTop,
                                                                })}
                                                                onBlur={() => setActiveDividendTooltip((current) => current?.monthKey === slot.key && current.portfolioId === segment.portfolioId ? null : current)}
                                                                aria-label={`${segment.portfolioName}, ${slot.label}, ${formatCurrency(segment.value)}, Monat gesamt ${formatCurrency(slot.total)}`}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                                <span className={styles.monthLabel}>
                                                    {shouldShowMonthLabel(
                                                        monthIndex,
                                                        dividendAnalysis.monthSlots.length,
                                                        selectedRange,
                                                        slot.monthStart,
                                                        previousSlot?.monthStart ?? null,
                                                        spanMonths,
                                                    )
                                                        ? formatAxisLabel(slot.monthStart, axisMode)
                                                        : ""}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {activeDividendTooltip ? (
                                    <div className={styles.dividendTooltip} style={{ left: `${activeDividendTooltip.leftPercent}%`, top: `${activeDividendTooltip.topPx}px` }}>
                                        <strong>{activeDividendTooltip.portfolioName}</strong>
                                        <span>{activeDividendTooltip.monthLabel}</span>
                                        <span>Segment: {formatCurrency(activeDividendTooltip.segmentValue)}</span>
                                        <span>Monat gesamt: {formatCurrency(activeDividendTooltip.monthTotal)}</span>
                                        <span>{activeDividendTooltip.paymentCount} Zahlung{activeDividendTooltip.paymentCount === 1 ? "" : "en"}</span>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={styles.inlineEmpty}>
                        {isManualEmptyScope
                            ? "Für dieses Asset liegen im ausgewählten Portfolio-Scope keine Dividenden vor."
                            : dividendAnalysis.hasAnyScopedDividendRows
                                ? "Im ausgewählten Zeitraum liegen keine Dividendenzahlungen vor."
                                : "Für dieses Asset liegen im ausgewählten Portfolio-Scope keine Dividenden vor."}
                    </div>
                )}
            </article>

            <article className={styles.card}>
                <div className={styles.cardHead}>
                    <h2>Performance-Heatmap</h2>
                    <button className="ui-btn ui-btn-ghost" type="button" onClick={() => setHeatmapOpen((v) => !v)}>{heatmapOpen ? "Ausblenden" : "Einblenden"}</button>
                </div>
                {!heatmapOpen ? <div className={styles.collapsedHint}>Heatmap eingeklappt.</div> : null}
                {heatmapOpen ? <div className={styles.inlineEmpty}>Für die Heatmap fehlen aktuell historische Marktpreise.</div> : null}
            </article>

            <article className={styles.card}>
                <div className={styles.cardHead}><h2>Asset-spezifische Aktivitäten</h2></div>
                {recentActivities.length > 0 ? (
                    <div className={styles.activityTable}>
                        <div className={styles.activityHeadRow}>
                            <span>Datum</span>
                            <span>Art</span>
                            <span>Portfolio</span>
                            <span>Stücke</span>
                            <span>Betrag</span>
                        </div>
                        {recentActivities.map((activity) => (
                            <div key={activity.id} className={styles.activityDataRow}>
                                <span className={styles.activityDate}>{new Date(activity.datetime).toLocaleDateString("de-DE")}</span>
                                <span className={styles.activityTypeCell}><span className={`${styles.activityTag} ${getActivityTypeTone(activity.type)}`}>{getActivityTypeLabel(activity.type)}</span></span>
                                <span>{activity.portfolioName || "Portfolio unbekannt"}</span>
                                <span className={styles.activityNumber}>{formatShares(activity.shares)}</span>
                                <span className={styles.activityNumber}>{formatCurrency(activity.amountNet ?? activity.amount ?? 0)}</span>
                            </div>
                        ))}
                    </div>
                ) : <div className={styles.inlineEmpty}>Keine Aktivitäten für dieses Asset im ausgewählten Portfolio-Scope.</div>}
                <div className={styles.activityAction}>
                    <Link href={`/activities?isin=${encodeURIComponent(normalizedAssetIsin || asset.isin)}`} className="ui-btn ui-btn-secondary">
                        Mehr Aktivitäten anzeigen
                    </Link>
                </div>
            </article>
        </main>
    );
}
