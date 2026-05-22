"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { loadPortfolioScope, resolvePortfolioScope, subscribeToLocalSettings } from "../../../lib/app-settings";
import { loadDashboardCache } from "../../../lib/dashboard-cache";
import { findAssetByKey, getAssetDetailKey, getAssetDisplayName, getAssetStatusLabel, getAssetWarnings, scopeAssetMetrics } from "../../../lib/asset-detail";
import { enrichAssetsWithMetadata } from "../../../lib/asset-metadata";
import { getActivityTypeLabel, normalizeExactIsin } from "../../../lib/local-activity-read-model";
import { formatCurrency, formatShares } from "../../../lib/format";
import { getAssetInitials, getAssetResolvedLogoUrl } from "../../../lib/asset-display";
import type { AssetSummary, PortfolioPosition } from "../../../lib/types";
import styles from "./AssetDetailPage.module.css";

function buildScopedPortfolioIds(asset: AssetSummary, loadedPortfolioIds: string[]): string[] {
    const scope = loadPortfolioScope();
    const loadedIds = loadedPortfolioIds.length > 0 ? loadedPortfolioIds : asset.portfolioIds;
    const resolved = resolvePortfolioScope(scope, loadedIds.map((id) => ({ id })));
    return resolved.selectedPortfolioIds.filter((id) => asset.portfolioIds.includes(id));
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

type DividendMonthBar = {
    key: string;
    label: string;
    value: number;
    paymentCount: number;
};

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
    const localStateSnapshot = useSyncExternalStore(
        subscribeToLocalAssetState,
        getLocalAssetStateSnapshot,
        () => JSON.stringify({ scope: { mode: "all", selectedPortfolioIds: [] }, cacheUpdatedAt: null }),
    );
    const [heatmapOpen, setHeatmapOpen] = useState(false);
    const [logoFailed, setLogoFailed] = useState(false);
    const [activeDividendMonth, setActiveDividendMonth] = useState<string | null>(null);

    const viewModel = useMemo(() => {
        if (!assetKey) return null;
        const cache = loadDashboardCache();
        if (!cache) return null;

        const assets = enrichAssetsWithMetadata([...(cache.activeAssets ?? []), ...(cache.closedAssets ?? [])]);
        const asset = findAssetByKey(assets, assetKey);
        if (!asset) return null;

        const selectedPortfolioIds = buildScopedPortfolioIds(asset, cache.selectedPortfolioIds ?? []);
        return {
            asset,
            metrics: scopeAssetMetrics(asset, selectedPortfolioIds),
            warnings: getAssetWarnings({ asset, consistencyReport: cache.consistencyReport ?? null, reconciliationWarnings: cache.reconciliationWarnings ?? [] }),
            lastUpdatedAt: cache.lastUpdatedAt ?? cache.generatedAt ?? null,
            selectedPortfolioIds,
            activityItems: cache.activityItems ?? [],
        };
    }, [assetKey, localStateSnapshot]);

    const logoResetIdentity = viewModel
        ? `${viewModel.asset.isin}|${getAssetResolvedLogoUrl(viewModel.asset) ?? ""}`
        : "";

    useEffect(() => {
        setLogoFailed(false);
    }, [logoResetIdentity]);

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

    const { asset, metrics, warnings, lastUpdatedAt, selectedPortfolioIds, activityItems } = viewModel;
    const displayName = getAssetDisplayName(asset);
    const logoUrl = getAssetResolvedLogoUrl(asset);
    const normalizedAssetIsin = normalizeExactIsin(asset.isin);
    const statusLabel = getAssetStatusLabel(metrics);
    const scopedIds = new Set(selectedPortfolioIds);
    const scopedAssetActivities = activityItems
        .filter((item) => normalizeExactIsin(item.isin) === normalizedAssetIsin)
        .filter((item) => !item.portfolioId || scopedIds.size === 0 || scopedIds.has(item.portfolioId))
        .sort((left, right) => right.datetime.localeCompare(left.datetime));
    const recentActivities = scopedAssetActivities
        .slice(0, 5);
    const scopedDividendActivities = scopedAssetActivities
        .filter((item) => item.type === "dividend");
    const scopedDividendTotal = scopedDividendActivities.length > 0
        ? scopedDividendActivities.reduce((sum, item) => sum + (item.amountNet ?? item.amount ?? 0), 0)
        : (metrics.totalDividendNet ?? 0);
    const scopedDividendCount = scopedDividendActivities.length;
    const hasDividends = scopedDividendCount > 0 || scopedDividendTotal > 0;
    const dividendBars = (() => {
        const grouped = new Map<string, { sum: number; count: number }>();

        for (const activity of scopedDividendActivities) {
            const date = new Date(activity.datetime);
            if (Number.isNaN(date.getTime())) {
                continue;
            }

            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            const amount = activity.amountNet ?? activity.amount ?? 0;
            const current = grouped.get(key) ?? { sum: 0, count: 0 };
            grouped.set(key, { sum: current.sum + amount, count: current.count + 1 });
        }

        return Array.from(grouped.entries())
            .sort((left, right) => left[0].localeCompare(right[0]))
            .slice(-12)
            .map(([key, value]) => {
                const [year, month] = key.split("-");
                return {
                    key,
                    label: `${month}.${year}`,
                    value: value.sum,
                    paymentCount: value.count,
                } satisfies DividendMonthBar;
            });
    })();
    const maxDividendBarValue = dividendBars.reduce((max, bar) => Math.max(max, bar.value), 0);
    const activeDividendInfo = activeDividendMonth
        ? dividendBars.find((bar) => bar.key === activeDividendMonth) ?? null
        : null;

    const hasScopedPosition = metrics.portfolioBreakdown.length > 0;

    const recentActivityRows = recentActivities;

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
                            onError={() => setLogoFailed(true)}
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

            <section className={styles.analysisGrid}>
                <article className={`${styles.card} ${styles.metricAnchor}`}>
                    <div className={styles.cardHead}><h2>Rendite & Kennzahlen</h2></div>
                    <div className={styles.metricGrid}>
                        <div><span>Stückzahl</span><strong>{hasScopedPosition ? formatShares(metrics.netShares) : "–"}</strong></div>
                        <div><span>Einstand</span><strong>{hasScopedPosition ? formatCurrency(metrics.remainingCostBasis) : "–"}</strong></div>
                        <div><span>Positionswert</span><strong>{hasScopedPosition ? formatCurrency(metrics.positionValue) : "–"}</strong></div>
                        <div><span>Gewinn / Verlust</span><strong className={(metrics.unrealizedPnL ?? 0) >= 0 ? styles.positive : styles.negative}>{hasScopedPosition ? formatCurrency(metrics.unrealizedPnL) : "–"}</strong></div>
                        <div><span>Portfolios im Scope</span><strong>{metrics.portfolioCount}</strong></div>
                        <div><span>Hinweise</span><strong>{warnings.length}</strong></div>
                    </div>
                    <div className={styles.inlineSection}>
                        <h3>Portfolio-Aufteilung</h3>
                        <PortfolioBreakdown entries={metrics.portfolioBreakdown} />
                    </div>
                    <div className={styles.metricNote}>Lokale Aktivitätsdaten vorhanden. Für vollständige Verläufe werden historische Marktpreise benötigt.</div>
                    {!hasScopedPosition ? (
                        <div className={styles.scopeHint}>Für den aktuell gewählten Portfolio-Scope liegt keine offene Position vor.</div>
                    ) : null}
                </article>

                <article className={`${styles.card} ${styles.chartCard}`}>
                    <div className={styles.cardHead}><h2>Chart</h2></div>
                    <div className={styles.chartMissing}>
                        <strong>Historische Kursdaten fehlen</strong>
                        <p>Aktivitäten und Dividenden sind vorhanden. Für Kurs-, Positionswert- und Performance-Verläufe werden historische Marktpreise benötigt.</p>
                    </div>
                </article>
            </section>

            {hasDividends ? (
                <article className={`${styles.card} ${styles.prominentCard}`}>
                    <div className={styles.cardHead}><h2>Dividenden</h2></div>
                    <div className={styles.dividendSummary}>
                        <div><span>Gesamtsumme</span><strong>{formatCurrency(scopedDividendTotal)}</strong></div>
                        <div><span>Anzahl Zahlungen</span><strong>{scopedDividendCount}</strong></div>
                    </div>
                    {dividendBars.length > 0 ? (
                        <div className={styles.dividendChart} aria-label="Monatliche Dividenden">
                            {dividendBars.map((bar) => {
                                const ratio = maxDividendBarValue > 0 ? bar.value / maxDividendBarValue : 0;
                                const height = Math.max(14, Math.round(ratio * 112));
                                return (
                                    <div key={bar.key} className={styles.dividendBarItem}>
                                        <div className={styles.dividendBarTrack}>
                                            <button
                                                type="button"
                                                className={styles.dividendBar}
                                                style={{ height: `${height}px` }}
                                                title={`${bar.label}: ${formatCurrency(bar.value)} · ${bar.paymentCount} Zahlungen`}
                                                aria-label={`${bar.label}: ${formatCurrency(bar.value)}, ${bar.paymentCount} Zahlungen`}
                                                onMouseEnter={() => setActiveDividendMonth(bar.key)}
                                                onMouseLeave={() => setActiveDividendMonth(null)}
                                                onFocus={() => setActiveDividendMonth(bar.key)}
                                                onBlur={() => setActiveDividendMonth(null)}
                                            />
                                        </div>
                                        <span>{bar.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className={styles.inlineEmpty}>Keine monatliche Dividendenverteilung im lokalen Scope verfügbar.</div>
                    )}
                    {scopedDividendActivities.length === 0 && (metrics.totalDividendNet ?? 0) > 0 ? (
                        <div className={styles.dividendHint}>Für diesen Scope sind aktuell keine lokalen Dividendeneinträge verfügbar.</div>
                    ) : null}
                    {activeDividendInfo ? (
                        <div className={styles.dividendHint}>
                            {activeDividendInfo.label} · {formatCurrency(activeDividendInfo.value)} · {activeDividendInfo.paymentCount} Zahlungen
                        </div>
                    ) : null}
                </article>
            ) : null}

            <article className={styles.card}>
                <div className={styles.cardHead}>
                    <h2>Performance-Heatmap</h2>
                    <button className="ui-btn ui-btn-ghost" type="button" onClick={() => setHeatmapOpen((v) => !v)}>{heatmapOpen ? "Ausblenden" : "Einblenden"}</button>
                </div>
                {!heatmapOpen ? <div className={styles.collapsedHint}>Heatmap eingeklappt.</div> : null}
                {heatmapOpen ? <div className={styles.inlineEmpty}>Für die Heatmap fehlen aktuell historische Marktpreise. Die Darstellung bleibt lokal und löst keine zusätzlichen Datenabrufe aus.</div> : null}
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
                        {recentActivityRows.map((activity) => (
                            <div key={activity.id} className={styles.activityDataRow}>
                                <span className={styles.activityDate}>{new Date(activity.datetime).toLocaleDateString("de-DE")}</span>
                                <span className={styles.activityTypeCell}><span className={`${styles.activityTag} ${getActivityTypeTone(activity.type)}`}>{getActivityTypeLabel(activity.type)}</span></span>
                                <span>{activity.portfolioName || "Portfolio unbekannt"}</span>
                                <span className={styles.activityNumber}>{formatShares(activity.shares)}</span>
                                <span className={styles.activityNumber}>{formatCurrency(activity.amountNet)}</span>
                            </div>
                        ))}
                    </div>
                ) : <div className={styles.inlineEmpty}>Keine lokalen Aktivitäten im aktuell ausgewählten Portfolio-Scope.</div>}
                <div className={styles.activityAction}>
                    <Link href={`/activities?isin=${encodeURIComponent(normalizedAssetIsin || asset.isin)}`} className="ui-btn ui-btn-secondary">
                        Mehr Aktivitäten anzeigen
                    </Link>
                </div>
            </article>
        </main>
    );
}
