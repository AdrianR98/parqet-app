"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
    loadAssetDetailRangeSettings,
    loadKnownPortfolios,
    loadPortfolioScope,
    resolvePortfolioScope,
    saveAssetDetailRangeSettings,
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
import { getAssetInitials, getAssetResolvedLogoUrl, isMeaningfulSymbol } from "../../../lib/asset-display";
import type { MarketDataPoint, MarketDataResponse, MarketDataStatus } from "../../../lib/market-data/types";
import type { ActivitiesAuditItem, AssetSummary, PortfolioPosition } from "../../../lib/types";
import styles from "./AssetDetailPage.module.css";

const MONTH_FORMATTER = new Intl.DateTimeFormat("de-DE", { month: "short", year: "2-digit" });
const CHART_HEIGHT_PX = 230;
const DETAIL_RANGE_OPTIONS = [
    { key: "1m", label: "1M", days: 31 },
    { key: "3m", label: "3M", days: 92 },
    { key: "6m", label: "6M", days: 183 },
    { key: "1y", label: "1Y", days: 366 },
    { key: "3y", label: "3Y", days: 365 * 3 + 2 },
    { key: "5y", label: "5Y", days: 365 * 5 + 2 },
    { key: "max", label: "MAX", days: null },
] as const;
const DIVIDEND_RANGE_OPTIONS = [
    { key: "ytd", label: "YTD" },
    { key: "12m", label: "1Y" },
    { key: "3y", label: "3Y" },
    { key: "5y", label: "5Y" },
    { key: "max", label: "MAX" },
] as const;

type DetailRangeKey = (typeof DETAIL_RANGE_OPTIONS)[number]["key"];
type DividendRangeKey = (typeof DIVIDEND_RANGE_OPTIONS)[number]["key"];
type ActivePriceTooltip = {
    index: number;
};

const MARKET_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
});
const MARKET_PRICE_FORMATTER = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const MARKET_PERCENT_FORMATTER = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

async function copyIdentifierToClipboard(value: string): Promise<boolean> {
    if (!value.trim()) {
        return false;
    }

    try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return true;
        }

        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.setAttribute("readonly", "true");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        return copied;
    } catch {
        return false;
    }
}
const DIVIDEND_CAGR_OPTIONS = [2, 3, 5, 7, 10, 15] as const;
const DIVIDEND_KPI_SETTINGS_KEY = "assettrace-dividend-kpi-settings-v1";
const PORTFOLIO_BREAKDOWN_SHARE_EPSILON = 0.00005;
const PORTFOLIO_BREAKDOWN_VALUE_EPSILON = 0.005;
const PORTFOLIO_CHART_PALETTE = [
    "var(--chart-series-1)",
    "var(--chart-series-2)",
    "var(--chart-series-3)",
    "var(--chart-series-4)",
    "var(--chart-series-5)",
    "var(--chart-series-6)",
    "var(--chart-series-7)",
    "var(--chart-series-8)",
    "var(--chart-series-9)",
    "var(--chart-series-10)",
    "var(--chart-series-11)",
    "var(--chart-series-12)",
] as const;
const PORTFOLIO_CHART_FALLBACK = "var(--chart-series-fallback)";

function parseMarketDataResponse(payload: unknown): MarketDataResponse | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    const candidate = payload as Partial<MarketDataResponse>;
    if (typeof candidate.ok !== "boolean" || typeof candidate.status !== "string") {
        return null;
    }

    return candidate as MarketDataResponse;
}

function rangeDaysFor(selectedRange: DetailRangeKey): number | null {
    return DETAIL_RANGE_OPTIONS.find((option) => option.key === selectedRange)?.days ?? null;
}

function toHistoryPeriod(selectedRange: DetailRangeKey): "1M" | "3M" | "6M" | "1Y" | "3Y" | "5Y" | "MAX" {
    if (selectedRange === "1m") return "1M";
    if (selectedRange === "3m") return "3M";
    if (selectedRange === "6m") return "6M";
    if (selectedRange === "1y") return "1Y";
    if (selectedRange === "3y") return "3Y";
    if (selectedRange === "5y") return "5Y";
    return "MAX";
}

function rangeIndex(selectedRange: DetailRangeKey): number {
    const index = DETAIL_RANGE_OPTIONS.findIndex((option) => option.key === selectedRange);
    return index >= 0 ? index : 0;
}

function dividendRangeIndex(selectedRange: DividendRangeKey): number {
    const index = DIVIDEND_RANGE_OPTIONS.findIndex((option) => option.key === selectedRange);
    return index >= 0 ? index : 0;
}

function normalizeDividendKpiSettings(value: unknown): { cagrPrimaryYears: number; cagrSecondaryYears: number } {
    const parsed = typeof value === "object" && value !== null
        ? (value as Partial<{ cagrPrimaryYears: unknown; cagrSecondaryYears: unknown }>)
        : {};
    const rawPrimary = typeof parsed.cagrPrimaryYears === "string" ? Number(parsed.cagrPrimaryYears) : parsed.cagrPrimaryYears;
    const rawSecondary = typeof parsed.cagrSecondaryYears === "string" ? Number(parsed.cagrSecondaryYears) : parsed.cagrSecondaryYears;
    return {
        cagrPrimaryYears: sanitizeCagrYears(rawPrimary, 5),
        cagrSecondaryYears: sanitizeCagrYears(rawSecondary, 10),
    };
}

function loadDividendKpiSettings(): { cagrPrimaryYears: number; cagrSecondaryYears: number } {
    if (typeof window === "undefined") {
        return { cagrPrimaryYears: 5, cagrSecondaryYears: 10 };
    }
    try {
        const raw = window.localStorage.getItem(DIVIDEND_KPI_SETTINGS_KEY);
        if (!raw) {
            return { cagrPrimaryYears: 5, cagrSecondaryYears: 10 };
        }
        return normalizeDividendKpiSettings(JSON.parse(raw));
    } catch {
        return { cagrPrimaryYears: 5, cagrSecondaryYears: 10 };
    }
}

function saveDividendKpiSettings(settings: { cagrPrimaryYears: number; cagrSecondaryYears: number }) {
    if (typeof window === "undefined") {
        return;
    }
    window.localStorage.setItem(
        DIVIDEND_KPI_SETTINGS_KEY,
        JSON.stringify(normalizeDividendKpiSettings(settings)),
    );
}

function filterMarketPointsByRange(points: MarketDataPoint[], selectedRange: DetailRangeKey): MarketDataPoint[] {
    if (points.length <= 1) {
        return points;
    }

    const days = rangeDaysFor(selectedRange);
    if (!days) {
        return points;
    }

    const latestPoint = points[points.length - 1];
    const latestDate = new Date(latestPoint.date);
    if (Number.isNaN(latestDate.getTime())) {
        return points;
    }

    const rangeStart = new Date(latestDate);
    rangeStart.setDate(rangeStart.getDate() - days);
    const filtered = points.filter((point) => {
        const date = new Date(point.date);
        if (Number.isNaN(date.getTime())) {
            return false;
        }
        return date >= rangeStart;
    });

    return filtered.length > 0 ? filtered : points;
}

function resolveMarketTone(changeAbsolute: number | null): "positive" | "negative" | "neutral" {
    if (changeAbsolute == null || !Number.isFinite(changeAbsolute)) {
        return "neutral";
    }
    return changeAbsolute >= 0 ? "positive" : "negative";
}

function marketDataMessageForStatus(status: MarketDataStatus, message?: string): string {
    if (message && message.trim().length > 0) {
        return message;
    }

    if (status === "missing_instrument") {
        return "Keine Instrumenten-Stammdaten gefunden.";
    }
    if (status === "missing_primary_mapping") {
        return "Kein verifiziertes Kursdaten-Mapping vorhanden.";
    }
    if (status === "primary_without_prices" || status === "no_prices") {
        return "Keine Kursdaten verfügbar.";
    }
    if (status === "excluded") {
        return "Dieses Instrument ist von der normalen Marktdatenverarbeitung ausgeschlossen.";
    }
    if (status === "legacy") {
        return "Dieses Instrument ist als historisch/Legacy markiert.";
    }
    if (status === "derivative") {
        return "Dieses Instrument ist als Derivat markiert und wird nicht wie ein normales Wertpapier ausgewertet.";
    }
    if (status === "unknown") {
        return "Kursdaten müssen manuell geprüft werden.";
    }
    if (status === "db_unavailable") {
        return "Kursdatenbank nicht verfügbar.";
    }
    if (status === "invalid_request") {
        return "Ungültige Kursdaten-Anfrage.";
    }

    return "Kursdaten konnten nicht geladen werden.";
}

function uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

function sanitizeCagrYears(candidate: unknown, fallback: number): number {
    return DIVIDEND_CAGR_OPTIONS.includes(candidate as (typeof DIVIDEND_CAGR_OPTIONS)[number]) ? Number(candidate) : fallback;
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

function PortfolioBreakdown({
    entries,
    portfolioColors = {},
}: {
    entries: PortfolioPosition[];
    portfolioColors?: Record<string, string>;
}) {
    if (entries.length === 0) {
        return <div className={styles.inlineEmpty}>Keine Portfolio-Anteile im aktuell ausgewählten Scope.</div>;
    }

    const totalShares = entries.reduce((sum, entry) => {
        const shares = Number(entry.netShares);
        const hasDisplayableShares = Number.isFinite(shares) && Math.abs(shares) >= PORTFOLIO_BREAKDOWN_SHARE_EPSILON;
        if (!hasDisplayableShares || shares <= 0) {
            return sum;
        }
        return sum + shares;
    }, 0);

    const sharePercentFormatter = new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    return (
        <div className={styles.breakdownList}>
            {entries.map((entry) => {
                const shares = Number(entry.netShares);
                const value = Number(entry.positionValue);
                const hasDisplayableShares = Number.isFinite(shares) && Math.abs(shares) >= PORTFOLIO_BREAKDOWN_SHARE_EPSILON;
                const hasDisplayableValue = Number.isFinite(value) && Math.abs(value) >= PORTFOLIO_BREAKDOWN_VALUE_EPSILON;
                const sharePercent =
                    hasDisplayableShares && shares > 0 && Number.isFinite(totalShares) && totalShares > 0
                        ? (shares / totalShares) * 100
                        : null;
                const color = portfolioColors[entry.portfolioId];

                return (
                    <div key={entry.portfolioId} className={styles.breakdownRow}>
                        <span className={styles.breakdownPortfolioCell}>
                            <span
                                className={styles.portfolioNameBadge}
                                style={{ "--portfolio-color": color } as CSSProperties}
                            >
                                {entry.portfolioName}
                            </span>
                        </span>
                        <span className={styles.breakdownNumberCell}>{hasDisplayableShares ? formatShares(entry.netShares) : "—"}</span>
                        <span className={styles.breakdownNumberCell}>{hasDisplayableShares && hasDisplayableValue ? formatCurrency(entry.positionValue) : "—"}</span>
                        <span className={styles.breakdownNumberCell}>
                            {!hasDisplayableShares || sharePercent == null ? "—" : `${sharePercentFormatter.format(sharePercent)} %`}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function getMarketDataResponseIsin(response: MarketDataResponse | null | undefined): string | null {
    const metadataIsin = normalizeExactIsin(String(response?.metadata?.isin ?? "").trim());
    if (metadataIsin) {
        return metadataIsin;
    }

    const dataIsin = normalizeExactIsin(String(response?.data?.isin ?? "").trim());
    return dataIsin || null;
}

function marketDataResponseMatchesIsin(response: MarketDataResponse | null | undefined, currentIsin: string): boolean {
    const normalizedCurrentIsin = normalizeExactIsin(currentIsin);
    if (!normalizedCurrentIsin) {
        return false;
    }

    const responseIsin = getMarketDataResponseIsin(response);
    return responseIsin === normalizedCurrentIsin;
}

function CopyableHeaderIdentifier({
    label,
    value,
}: {
    label: "ISIN" | "WKN";
    value: string;
}) {
    const [copied, setCopied] = useState(false);

    return (
        <span className={styles.headerMetaPart}>
            <span>{label} </span>
            <button
                type="button"
                className={`${styles.inlineMetaCopyButton} ${copied ? styles.inlineMetaCopyButtonCopied : ""}`}
                title={`${label} kopieren`}
                aria-label={`${label} ${value} kopieren`}
                onClick={async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const ok = await copyIdentifierToClipboard(value);
                    if (!ok) {
                        return;
                    }
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1000);
                }}
            >
                {value}
            </button>
        </span>
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
    yearlySums: Map<number, number>;
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
    label: ReactNode;
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

function calculateDividendCagr(yearlySums: Map<number, number>, years: number): number | null {
    return computeCagr(yearlySums, years);
}

function monthDiffInclusive(start: Date, end: Date): number {
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

function resolveAxisMode(range: DetailRangeKey | DividendRangeKey, spanMonths: number): "monthYear" | "year" {
    if (range === "1m" || range === "3m" || range === "6m" || range === "1y" || range === "ytd" || range === "12m" || range === "3y") {
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
    range: DetailRangeKey | DividendRangeKey,
    date: Date,
    previousDate: Date | null,
    spanMonths: number,
): boolean {
    if (index === 0 || index === total - 1) {
        return true;
    }

    if (range === "1m" || range === "3m" || range === "6m" || range === "1y" || range === "ytd" || range === "12m") {
        return true;
    }

    if (range === "3y") {
        const step = total > 20 ? 3 : 2;
        return index % step === 0;
    }

    if (range === "5y") {
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
    selectedRange: DividendRangeKey;
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
        const start = input.selectedRange === "max"
            ? nowMonth
            : input.selectedRange === "ytd"
                ? new Date(nowMonth.getFullYear(), 0, 1)
                : input.selectedRange === "12m"
                    ? addMonths(nowMonth, -11)
                    : input.selectedRange === "3y"
                        ? addMonths(nowMonth, -35)
                        : addMonths(nowMonth, -59);
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
            yearlySums,
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
    const startMonth = input.selectedRange === "max"
        ? monthStart(earliestDate ?? latestDate)
        : input.selectedRange === "ytd"
            ? new Date(endMonth.getFullYear(), 0, 1)
            : input.selectedRange === "12m"
                ? addMonths(endMonth, -11)
                : input.selectedRange === "3y"
                    ? addMonths(endMonth, -35)
                    : addMonths(endMonth, -59);
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

    const portfolios = Array.from(portfolioTotals.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .map(([id, entry], idx) => ({
            id,
            label: entry.name,
            total: entry.total,
            color: PORTFOLIO_CHART_PALETTE[idx % PORTFOLIO_CHART_PALETTE.length],
        }));

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
        input.selectedRange === "3y" || input.selectedRange === "5y" || input.selectedRange === "max";
    const monthSlots = shouldCompressEmptyMonths
        ? monthSlotsAll.filter((slot) => slot.total > 0)
        : monthSlotsAll;

    const rawMaxValue = monthSlots.reduce((m, slot) => Math.max(m, slot.total), 0);
    const { maxRounded, ticks: yTicks } = buildNiceTicks(rawMaxValue);

    return {
        total,
        paymentCount,
        ttmYield,
        yearlySums,
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

function MarketPriceChart({
    points,
    selectedRange,
    currency,
}: {
    points: MarketDataPoint[];
    selectedRange: DetailRangeKey;
    currency: string | null;
}) {
    const [activeTooltip, setActiveTooltip] = useState<ActivePriceTooltip | null>(null);

    const filteredPoints = useMemo(() => filterMarketPointsByRange(points, selectedRange), [points, selectedRange]);
    const yValues = filteredPoints.map((point) => point.close);
    const min = Math.min(...yValues);
    const max = Math.max(...yValues);
    const ySpan = Math.max(0.0001, max - min);
    const leftPad = 48;
    const rightPad = 12;
    const topPad = 12;
    const bottomPad = 24;
    const width = 1000;
    const height = 450;
    const plotWidth = width - leftPad - rightPad;
    const plotHeight = height - topPad - bottomPad;

    const plottedPoints = filteredPoints.map((point, index) => {
        const xRatio = filteredPoints.length <= 1 ? 0 : index / (filteredPoints.length - 1);
        const yRatio = (point.close - min) / ySpan;
        return {
            ...point,
            x: leftPad + xRatio * plotWidth,
            y: topPad + (1 - yRatio) * plotHeight,
        };
    });

    const path = plottedPoints
        .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ");
    const areaPath = plottedPoints.length > 1
        ? `${path} L${plottedPoints[plottedPoints.length - 1].x.toFixed(2)} ${(height - bottomPad).toFixed(2)} L${plottedPoints[0].x.toFixed(2)} ${(height - bottomPad).toFixed(2)} Z`
        : "";

    const latestPoint = filteredPoints[filteredPoints.length - 1];
    const firstPoint = filteredPoints[0];
    const startValue = firstPoint.close;
    const endValue = latestPoint.close;
    const changeAbsolute = endValue - startValue;
    const changePercent = startValue !== 0 ? (changeAbsolute / startValue) * 100 : 0;

    const activePoint = activeTooltip ? plottedPoints[activeTooltip.index] : null;
    const xLabelIndices = filteredPoints.length <= 1
        ? [0]
        : Array.from(new Set([0, Math.floor((filteredPoints.length - 1) / 3), Math.floor((filteredPoints.length - 1) * 2 / 3), filteredPoints.length - 1]));
    const yTicks = [0, 1, 2, 3, 4].map((step) => min + (ySpan * step) / 4);
    const changeClass = changeAbsolute >= 0 ? styles.positive : styles.negative;
    const marketTone = resolveMarketTone(changeAbsolute);
    const xAxisY = height - bottomPad;
    const normalizedCurrencyRaw = (currency ?? "").trim();
    const normalizedCurrency = normalizedCurrencyRaw === "GBp"
        ? "GBp"
        : normalizedCurrencyRaw.toUpperCase();
    const currencyLabel = normalizedCurrency ? `Kurs in ${normalizedCurrency}` : "Kurs";
    const priceWithCurrency = (value: number): string => {
        const formatted = MARKET_PRICE_FORMATTER.format(value);
        return normalizedCurrency ? `${formatted} ${normalizedCurrency}` : formatted;
    };

    function resolveNearestIndex(clientX: number, svgRectLeft: number, svgRectWidth: number): number {
        if (filteredPoints.length <= 1) {
            return 0;
        }
        const normalizedX = Math.max(0, Math.min(1, (clientX - svgRectLeft) / svgRectWidth));
        return Math.max(0, Math.min(filteredPoints.length - 1, Math.round(normalizedX * (filteredPoints.length - 1))));
    }

    return (
        <div className={styles.marketChartWrap}>
            <div className={styles.marketKpiRow}>
                <div className={styles.marketKpiItem}>
                    <span>{currencyLabel}</span>
                    <strong>{priceWithCurrency(latestPoint.close)}</strong>
                    <small>{MARKET_DATE_FORMATTER.format(new Date(latestPoint.date))}</small>
                </div>
                <div className={styles.marketKpiItem}>
                    <span>Kursänderung</span>
                    <strong className={changeClass}>
                        {changeAbsolute >= 0 ? "+" : ""}{priceWithCurrency(changeAbsolute)} ({changePercent >= 0 ? "+" : ""}{MARKET_PERCENT_FORMATTER.format(changePercent)} %)
                    </strong>
                    <small>Total Return inkl. Dividenden folgt separat.</small>
                </div>
            </div>
            <div className={styles.marketChartFrame}>
                <svg viewBox={`0 0 ${width} ${height}`} className={styles.marketChartSvg} role="img" aria-label="Schlusskurs-Verlauf">
                    {yTicks.map((tick) => {
                        const ratio = (tick - min) / ySpan;
                        const y = topPad + (1 - ratio) * plotHeight;
                        return (
                            <g key={`tick-${tick}`}>
                                <line x1={leftPad} x2={width - rightPad} y1={y} y2={y} className={styles.marketGridLine} />
                                <text x={leftPad - 8} y={y + 4} className={styles.marketYAxisLabel} textAnchor="end">
                                    {MARKET_PRICE_FORMATTER.format(tick)}
                                </text>
                            </g>
                        );
                    })}

                    <line x1={leftPad} x2={width - rightPad} y1={xAxisY} y2={xAxisY} className={styles.marketAxisLine} />
                    {xLabelIndices.map((index) => {
                        const point = plottedPoints[index];
                        return (
                            <text key={`x-${point.date}-${index}`} x={point.x} y={height - 8} className={styles.marketXAxisLabel} textAnchor="middle">
                                {new Date(point.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                            </text>
                        );
                    })}

                    {areaPath ? <path d={areaPath} className={`${styles.marketAreaPath} ${styles[`marketAreaPath_${marketTone}`]}`} /> : null}
                    <path d={path} className={`${styles.marketLinePath} ${styles[`marketLinePath_${marketTone}`]}`} />
                    {activePoint ? (
                        <>
                            <line
                                x1={activePoint.x}
                                x2={activePoint.x}
                                y1={topPad}
                                y2={xAxisY}
                                className={styles.marketCrosshairLine}
                            />
                            <circle cx={activePoint.x} cy={activePoint.y} r={4} className={`${styles.marketPointDot} ${styles[`marketPointDot_${marketTone}`]}`} />
                        </>
                    ) : null}

                    <rect
                        x={leftPad}
                        y={topPad}
                        width={plotWidth}
                        height={plotHeight}
                        className={styles.marketHoverOverlay}
                        onMouseMove={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            const index = resolveNearestIndex(event.clientX, rect.left, rect.width);
                            setActiveTooltip({ index });
                        }}
                        onMouseLeave={() => setActiveTooltip(null)}
                        onFocus={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            const index = resolveNearestIndex(rect.left + rect.width / 2, rect.left, rect.width);
                            setActiveTooltip({ index });
                        }}
                        onBlur={() => setActiveTooltip(null)}
                        tabIndex={0}
                        aria-label="Marktpreis-Interaktion"
                    />
                </svg>

                {activePoint ? (
                    <div
                        className={styles.marketTooltip}
                        style={{
                            left: `${(activePoint.x / width) * 100}%`,
                            top: `${(activePoint.y / height) * 100}%`,
                        }}
                    >
                        <strong>{MARKET_DATE_FORMATTER.format(new Date(activePoint.date))}</strong>
                        <span>Schlusskurs: {priceWithCurrency(activePoint.close)}</span>
                        {typeof activePoint.open === "number" ? <span>Open: {priceWithCurrency(activePoint.open)}</span> : null}
                        {typeof activePoint.high === "number" ? <span>High: {priceWithCurrency(activePoint.high)}</span> : null}
                        {typeof activePoint.low === "number" ? <span>Low: {priceWithCurrency(activePoint.low)}</span> : null}
                    </div>
                ) : null}
            </div>
        </div>
    );
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
    const [marketDataResponse, setMarketDataResponse] = useState<MarketDataResponse | null>(null);
    const [lastRenderableMarketDataResponse, setLastRenderableMarketDataResponse] = useState<MarketDataResponse | null>(null);
    const [marketDataLoading, setMarketDataLoading] = useState(false);
    const [marketDataNetworkError, setMarketDataNetworkError] = useState<string | null>(null);
    const [selectedPricePeriod, setSelectedPricePeriod] = useState<DetailRangeKey>(() => loadAssetDetailRangeSettings().pricePeriod);
    const [selectedDividendPeriod, setSelectedDividendPeriod] = useState<DividendRangeKey>(() => loadAssetDetailRangeSettings().dividendPeriod);
    const [cagrPrimaryYears, setCagrPrimaryYears] = useState(5);
    const [cagrSecondaryYears, setCagrSecondaryYears] = useState(10);
    const [activeCagrMenu, setActiveCagrMenu] = useState<"primary" | "secondary" | null>(null);
    const [dividendKpiSettingsReady, setDividendKpiSettingsReady] = useState(false);
    const marketRequestSequence = useRef(0);

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
    const currentIsin = viewModel?.asset?.isin?.trim() ?? "";

    const loadMarketData = useCallback(async (signal?: AbortSignal) => {
        if (!currentIsin) {
            setMarketDataResponse({
                ok: false,
                status: "invalid_request",
                message: "Ungültige ISIN.",
            });
            return;
        }

        const requestId = marketRequestSequence.current + 1;
        marketRequestSequence.current = requestId;
        setMarketDataNetworkError(null);

        setMarketDataLoading(true);

        try {
            const query = `/api/market-data/history?isin=${encodeURIComponent(currentIsin)}&period=${toHistoryPeriod(selectedPricePeriod)}`;
            const response = await fetch(query, { method: "GET", signal });
            const payload = parseMarketDataResponse(await response.json());

            if (signal?.aborted || requestId !== marketRequestSequence.current) {
                return;
            }

            if (!payload) {
                setMarketDataResponse({
                    ok: false,
                    status: "not_available",
                    message: "Kursdaten konnten nicht geladen werden.",
                });
                return;
            }

            setMarketDataResponse(payload);
            if (
                payload.ok &&
                (payload.data?.points?.length ?? 0) > 0 &&
                marketDataResponseMatchesIsin(payload, currentIsin)
            ) {
                setLastRenderableMarketDataResponse(payload);
            }
        } catch (error) {
            if (signal?.aborted || requestId !== marketRequestSequence.current) {
                return;
            }

            setMarketDataNetworkError(error instanceof Error ? error.message : "Unbekannter Fehler");
            setMarketDataResponse({
                ok: false,
                status: "not_available",
                message: "Kursdaten konnten nicht geladen werden.",
            });
        } finally {
            if (signal?.aborted || requestId !== marketRequestSequence.current) {
                return;
            }

            setMarketDataLoading(false);
        }
    }, [currentIsin, selectedPricePeriod]);

    useEffect(() => {
        if (!currentIsin) {
            return;
        }

        const controller = new AbortController();
        void loadMarketData(controller.signal);

        return () => {
            controller.abort();
        };
    }, [currentIsin, selectedPricePeriod, loadMarketData]);

    useEffect(() => {
        setMarketDataResponse(null);
        setLastRenderableMarketDataResponse(null);
        setMarketDataNetworkError(null);
    }, [currentIsin]);

    useEffect(() => {
        const settings = loadDividendKpiSettings();
        setCagrPrimaryYears(settings.cagrPrimaryYears);
        setCagrSecondaryYears(settings.cagrSecondaryYears);
        setDividendKpiSettingsReady(true);
    }, []);

    useEffect(() => {
        if (!dividendKpiSettingsReady) {
            return;
        }
        saveDividendKpiSettings({
            cagrPrimaryYears,
            cagrSecondaryYears,
        });
    }, [cagrPrimaryYears, cagrSecondaryYears, dividendKpiSettingsReady]);

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
    const headerIsin = String(asset.instrument?.isin ?? asset.isin ?? "").trim();
    const headerWkn = String(asset.instrument?.wkn ?? asset.wkn ?? "").trim();

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
        selectedRange: selectedDividendPeriod,
    });
    const primaryCagr = calculateDividendCagr(dividendAnalysis.yearlySums, cagrPrimaryYears);
    const secondaryCagr = calculateDividendCagr(dividendAnalysis.yearlySums, cagrSecondaryYears);
    const dividendPortfolioColorById = Object.fromEntries(
        dividendAnalysis.portfolios.map((portfolio) => [portfolio.id, portfolio.color]),
    );

    const hasScopedPosition = metrics.portfolioBreakdown.length > 0;
    const recentActivities = scopedAssetActivities.slice(0, 5);
    const noScopedAssetMessage = "Dieses Asset ist in den ausgewählten Portfolios nicht enthalten.";
    const currentMarketDataResponse = marketDataResponseMatchesIsin(marketDataResponse, currentIsin)
        ? marketDataResponse
        : null;
    const marketStatus = currentMarketDataResponse?.status ?? null;
    const marketDataPoints = currentMarketDataResponse?.data?.points ?? [];
    const hasMarketSeries = Boolean(currentMarketDataResponse?.ok && marketDataPoints.length > 0);
    const hasLastRenderableSeries = Boolean(
        marketDataResponseMatchesIsin(lastRenderableMarketDataResponse, currentIsin) &&
        lastRenderableMarketDataResponse?.ok &&
        (lastRenderableMarketDataResponse.data?.points?.length ?? 0) > 0,
    );
    const renderableMarketResponse = hasMarketSeries ? currentMarketDataResponse : hasLastRenderableSeries ? lastRenderableMarketDataResponse : null;
    const renderableMarketPoints = renderableMarketResponse?.data?.points ?? [];
    const hasRenderableMarketSeries = renderableMarketPoints.length > 0;
    const marketMessage = currentMarketDataResponse
        ? marketDataMessageForStatus(currentMarketDataResponse.status, currentMarketDataResponse.message)
        : "Für dieses Asset liegen noch keine lokal gecachten Kursdaten vor.";
    const mappingStatus = currentMarketDataResponse?.metadata?.mappingStatus ?? null;
    const hasMarketWarningWithData =
        hasRenderableMarketSeries &&
        marketStatus !== "db_hit" &&
        !marketDataLoading;
    const headerTickerFromInstrument = String(asset.instrument?.primaryMapping?.symbol ?? "").trim();
    const headerTickerFromHistory = String(currentMarketDataResponse?.metadata?.symbol ?? currentMarketDataResponse?.data?.symbol ?? "").trim();
    const headerTickerRaw = headerTickerFromInstrument || headerTickerFromHistory;
    const headerTicker = isMeaningfulSymbol(headerTickerRaw || null, headerIsin || asset.isin) ? headerTickerRaw : "";
    const headerExchange = String(asset.instrument?.primaryMapping?.exchange ?? currentMarketDataResponse?.metadata?.exchange ?? "").trim();

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
                    <div className={styles.metaLine}>
                        <span className={styles.headerMetaList}>
                            {headerIsin ? <CopyableHeaderIdentifier label="ISIN" value={headerIsin} /> : <span className={styles.headerMetaPart}>ISIN {asset.isin || getAssetDetailKey(asset)}</span>}
                            {headerWkn ? (
                                <>
                                    <span className={styles.headerMetaSeparator}>·</span>
                                    <CopyableHeaderIdentifier label="WKN" value={headerWkn} />
                                </>
                            ) : null}
                            {headerTicker ? (
                                <>
                                    <span className={styles.headerMetaSeparator}>·</span>
                                    <span className={styles.headerMetaPart}>TICKER {headerTicker}</span>
                                </>
                            ) : null}
                            {headerExchange ? (
                                <>
                                    <span className={styles.headerMetaSeparator}>·</span>
                                    <span className={styles.headerMetaPart}>BÖRSE {headerExchange}</span>
                                </>
                            ) : null}
                        </span>
                    </div>
                    <div className={styles.metaSubline}>{statusLabel}</div>
                    <div className={styles.metaSubline}>Stand: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString("de-DE") : "unbekannt"}</div>
                </div>
            </section>

            {isManualEmptyScope ? <div className="ui-banner ui-banner-info">{noScopedAssetMessage}</div> : null}

            <section className={styles.analysisGrid}>
                <article className={`${styles.card} ${styles.chartCard}`}>
                    <div className={styles.cardHead}>
                        <h2>Kursentwicklung</h2>
                        <div
                            className={styles.marketRangeSelector}
                            role="group"
                            aria-label="Zeitraum auswählen"
                            style={{ gridTemplateColumns: `repeat(${DETAIL_RANGE_OPTIONS.length}, minmax(0, 1fr))` }}
                        >
                            <span
                                aria-hidden="true"
                                className={styles.marketRangeIndicator}
                                style={{
                                    width: `calc((100% - 8px) / ${DETAIL_RANGE_OPTIONS.length})`,
                                    transform: `translateX(${rangeIndex(selectedPricePeriod) * 100}%)`,
                                }}
                            />
                                {DETAIL_RANGE_OPTIONS.map((option) => (
                                    <button
                                        key={option.key}
                                        type="button"
                                        aria-pressed={selectedPricePeriod === option.key}
                                        className={`${styles.marketRangeButton} ${selectedPricePeriod === option.key ? styles.marketRangeButtonActive : ""}`}
                                        onClick={() => {
                                            setSelectedPricePeriod(option.key);
                                            const currentSettings = loadAssetDetailRangeSettings();
                                            saveAssetDetailRangeSettings({
                                                ...currentSettings,
                                                pricePeriod: option.key,
                                            });
                                        }}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                        </div>
                    </div>
                    <div className={styles.marketChartStage}>
                        {hasRenderableMarketSeries ? (
                            <div className={`${styles.marketChartSection} ${marketDataLoading ? styles.marketChartSectionLoading : ""}`}>
                                <MarketPriceChart
                                    points={renderableMarketPoints}
                                    selectedRange={selectedPricePeriod}
                                    currency={renderableMarketResponse?.metadata?.currency ?? null}
                                />
                                {hasMarketWarningWithData ? (
                                    <div className={styles.marketStatusWarning}>{marketMessage}</div>
                                ) : null}
                                {marketDataLoading ? (
                                    <div className={styles.marketLoadingOverlay} aria-live="polite">
                                        Kursdaten werden geladen …
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className={styles.chartMissing}>
                                <strong>
                                    {mappingStatus === "missing_instrument"
                                        ? "Keine Instrumenten-Stammdaten gefunden"
                                        : mappingStatus === "missing_primary_mapping"
                                            ? "Kein verifiziertes Kursdaten-Mapping vorhanden"
                                            : mappingStatus === "primary_without_prices" || mappingStatus === "no_prices"
                                                ? "Keine Kursdaten verfügbar"
                                                : mappingStatus === "excluded"
                                                    ? "Instrument ausgeschlossen"
                                                    : mappingStatus === "legacy"
                                                        ? "Instrument als Legacy markiert"
                                                        : mappingStatus === "derivative"
                                                            ? "Instrument als Derivat markiert"
                                                            : mappingStatus === "unknown"
                                                                ? "Kursdaten müssen manuell geprüft werden"
                                                                : mappingStatus === "db_unavailable"
                                                                    ? "Kursdatenbank nicht verfügbar"
                                                                    : marketStatus === "invalid_request"
                                                                        ? "Ungültige Kursdaten-Anfrage"
                                                                        : "Historische Kursdaten fehlen"}
                                </strong>
                                <p>{marketDataLoading ? "Kursdaten werden geladen …" : marketMessage}</p>
                                {mappingStatus === "excluded" || mappingStatus === "legacy" || mappingStatus === "derivative" || mappingStatus === "unknown" ? (
                                    <p className={styles.marketMappingHint}>
                                        Status: <code>{currentMarketDataResponse?.metadata?.marketDataStatus ?? "unknown"}</code>
                                        {currentMarketDataResponse?.metadata?.marketDataStatusReason ? ` · ${currentMarketDataResponse.metadata.marketDataStatusReason}` : ""}
                                    </p>
                                ) : null}
                            </div>
                        )}
                    </div>
                    {marketDataNetworkError ? <div className={styles.marketStatusWarning}>Netzwerkhinweis: {marketDataNetworkError}</div> : null}
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
                        {isManualEmptyScope ? (
                            <div className={styles.inlineEmpty}>{noScopedAssetMessage}</div>
                        ) : (
                            <>
                                <div className={styles.breakdownHeader}>
                                    <span className={styles.breakdownHeaderPortfolio}>Portfolio</span>
                                    <span className={styles.breakdownHeaderNumeric}>Bestand</span>
                                    <span className={styles.breakdownHeaderNumeric}>Wert</span>
                                    <span className={styles.breakdownHeaderNumeric}>Anteil</span>
                                </div>
                                <div className={styles.breakdownScrollArea}>
                                    <PortfolioBreakdown entries={metrics.portfolioBreakdown} portfolioColors={dividendPortfolioColorById} />
                                </div>
                            </>
                        )}
                    </div>
                </article>
            </section>

            <article className={`${styles.card} ${styles.prominentCard}`}>
                <div className={styles.cardHead}>
                    <h2>Dividendenanalyse</h2>
                    <div
                        className={styles.marketRangeSelector}
                        role="group"
                        aria-label="Dividenden-Zeitraum auswählen"
                        style={{ gridTemplateColumns: `repeat(${DIVIDEND_RANGE_OPTIONS.length}, minmax(0, 1fr))` }}
                    >
                        <span
                            aria-hidden="true"
                            className={styles.marketRangeIndicator}
                            style={{
                                width: `calc((100% - 8px) / ${DIVIDEND_RANGE_OPTIONS.length})`,
                                transform: `translateX(${dividendRangeIndex(selectedDividendPeriod) * 100}%)`,
                            }}
                        />
                        {DIVIDEND_RANGE_OPTIONS.map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                aria-pressed={selectedDividendPeriod === option.key}
                                className={`${styles.marketRangeButton} ${selectedDividendPeriod === option.key ? styles.marketRangeButtonActive : ""}`}
                                onClick={() => {
                                    setSelectedDividendPeriod(option.key);
                                    const currentSettings = loadAssetDetailRangeSettings();
                                    saveAssetDetailRangeSettings({
                                        ...currentSettings,
                                        dividendPeriod: option.key,
                                    });
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
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
                        label={(
                            <span className={styles.kpiLabelWrap}>
                                <button
                                    type="button"
                                    className={styles.kpiLabelButton}
                                    aria-haspopup="menu"
                                    aria-label={`CAGR-Zeitraum auswählen, aktuell ${cagrPrimaryYears} Jahre`}
                                    onClick={() => setActiveCagrMenu((current) => current === "primary" ? null : "primary")}
                                >
                                    CAGR {cagrPrimaryYears} Jahre ▾
                                </button>
                                {activeCagrMenu === "primary" ? (
                                    <span className={styles.kpiDropdownMenu} role="menu">
                                        {DIVIDEND_CAGR_OPTIONS.map((years) => (
                                            <button
                                                key={`primary-${years}`}
                                                type="button"
                                                className={styles.kpiDropdownItem}
                                                role="menuitem"
                                                onClick={() => {
                                                    setCagrPrimaryYears(years);
                                                    saveDividendKpiSettings({
                                                        cagrPrimaryYears: years,
                                                        cagrSecondaryYears,
                                                    });
                                                    setActiveCagrMenu(null);
                                                }}
                                            >
                                                {years} Jahre
                                            </button>
                                        ))}
                                    </span>
                                ) : null}
                            </span>
                        )}
                        value={formatPercent(primaryCagr)}
                        helpText={`Durchschnittliches jährliches Wachstum der lokalen Netto-Dividenden über ${cagrPrimaryYears} Jahre. Bei unzureichenden Daten wird kein Wert angezeigt.`}
                    />
                    <DividendKpiCard
                        label={(
                            <span className={styles.kpiLabelWrap}>
                                <button
                                    type="button"
                                    className={styles.kpiLabelButton}
                                    aria-haspopup="menu"
                                    aria-label={`CAGR-Zeitraum auswählen, aktuell ${cagrSecondaryYears} Jahre`}
                                    onClick={() => setActiveCagrMenu((current) => current === "secondary" ? null : "secondary")}
                                >
                                    CAGR {cagrSecondaryYears} Jahre ▾
                                </button>
                                {activeCagrMenu === "secondary" ? (
                                    <span className={styles.kpiDropdownMenu} role="menu">
                                        {DIVIDEND_CAGR_OPTIONS.map((years) => (
                                            <button
                                                key={`secondary-${years}`}
                                                type="button"
                                                className={styles.kpiDropdownItem}
                                                role="menuitem"
                                                onClick={() => {
                                                    setCagrSecondaryYears(years);
                                                    saveDividendKpiSettings({
                                                        cagrPrimaryYears,
                                                        cagrSecondaryYears: years,
                                                    });
                                                    setActiveCagrMenu(null);
                                                }}
                                            >
                                                {years} Jahre
                                            </button>
                                        ))}
                                    </span>
                                ) : null}
                            </span>
                        )}
                        value={formatPercent(secondaryCagr)}
                        helpText={`Durchschnittliches jährliches Wachstum der lokalen Netto-Dividenden über ${cagrSecondaryYears} Jahre. Bei unzureichenden Daten wird kein Wert angezeigt.`}
                    />
                </div>

                {dividendAnalysis.monthSlots.length > 0 && dividendAnalysis.hasAnyValidScopedDividendRows && !isManualEmptyScope ? (
                    <div className={styles.dividendModule}>
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
                                        const axisMode = resolveAxisMode(selectedDividendPeriod, spanMonths);
                                        return (
                                            <div key={slot.key} className={styles.dividendBarItem}>
                                                <div className={styles.dividendBarTrack}>
                                                    {slot.segments.map((segment, segmentIndex) => {
                                                        const ratio = dividendAnalysis.maxValue > 0 ? segment.value / dividendAnalysis.maxValue : 0;
                                                        const height = ratio * 100;
                                                        const bottom = accumulated;
                                                        accumulated += height;
                                                        const color = dividendAnalysis.portfolios.find((entry) => entry.id === segment.portfolioId)?.color ?? PORTFOLIO_CHART_FALLBACK;
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
                                                        selectedDividendPeriod,
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
