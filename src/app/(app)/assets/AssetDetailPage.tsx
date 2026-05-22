"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { loadPortfolioScope, resolvePortfolioScope } from "../../../lib/app-settings";
import { loadDashboardCache } from "../../../lib/dashboard-cache";
import { findAssetByKey, getAssetDetailKey, getAssetDisplayName, getAssetInitials, getAssetLogoUrl, getAssetStatusLabel, getAssetWarnings, scopeAssetMetrics } from "../../../lib/asset-detail";
import { enrichAssetsWithMetadata } from "../../../lib/asset-metadata";
import { formatCurrency, formatShares } from "../../../lib/format";
import type { AssetSummary, PortfolioPosition } from "../../../lib/types";
import styles from "./AssetDetailPage.module.css";

function buildScopedPortfolioIds(asset: AssetSummary, loadedPortfolioIds: string[]): string[] {
    const scope = loadPortfolioScope();
    const loadedIds = loadedPortfolioIds.length > 0 ? loadedPortfolioIds : asset.portfolioIds;
    const resolved = resolvePortfolioScope(scope, loadedIds.map((id) => ({ id })));
    return resolved.selectedPortfolioIds.filter((id) => asset.portfolioIds.includes(id));
}

function subscribeToLocalAssetState(onStoreChange: () => void) {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("storage", onStoreChange);
    return () => window.removeEventListener("storage", onStoreChange);
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

export default function AssetDetailPage() {
    const searchParams = useSearchParams();
    const assetKey = searchParams.get("id")?.trim() ?? "";
    const canReadLocalState = useSyncExternalStore(subscribeToLocalAssetState, () => true, () => false);
    const [heatmapOpen, setHeatmapOpen] = useState(false);

    const viewModel = useMemo(() => {
        if (!assetKey || !canReadLocalState) return null;
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
        };
    }, [assetKey, canReadLocalState]);

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

    const { asset, metrics, warnings, lastUpdatedAt } = viewModel;
    const displayName = getAssetDisplayName(asset);
    const logoUrl = getAssetLogoUrl(asset);
    const statusLabel = getAssetStatusLabel(metrics);
    const hasDividends = (metrics.totalDividendNet ?? 0) > 0 || asset.dividendCount > 0;

    return (
        <main className={styles.page}>
            <div className={styles.breadcrumbRow}>
                <Link href="/dashboard" className="ui-btn ui-btn-ghost">← Übersicht</Link>
            </div>

            <section className={styles.headerCard}>
                <div className={styles.assetMark}>{logoUrl ? <Image src={logoUrl} alt="" width={46} height={46} /> : <span>{getAssetInitials(asset)}</span>}</div>
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
                        <div><span>Stückzahl</span><strong>{formatShares(metrics.netShares)}</strong></div>
                        <div><span>Einstand</span><strong>{formatCurrency(metrics.remainingCostBasis)}</strong></div>
                        <div><span>Positionswert</span><strong>{formatCurrency(metrics.positionValue)}</strong></div>
                        <div><span>Gewinn / Verlust</span><strong className={(metrics.unrealizedPnL ?? 0) >= 0 ? styles.positive : styles.negative}>{formatCurrency(metrics.unrealizedPnL)}</strong></div>
                        <div><span>Portfolios im Scope</span><strong>{metrics.portfolioCount}</strong></div>
                        <div><span>Hinweise</span><strong>{warnings.length}</strong></div>
                    </div>
                    <div className={styles.metricNote}>Lokale Aktivitätsdaten vorhanden. Für vollständige Verläufe werden historische Marktpreise benötigt.</div>
                </article>

                <article className={`${styles.card} ${styles.chartCard}`}>
                    <div className={styles.cardHead}><h2>Chart</h2></div>
                    <div className={styles.chartMissing}>
                        <strong>Historische Kursdaten fehlen</strong>
                        <p>Aktivitäten und Dividenden sind vorhanden. Für Kurs-, Positionswert- und Performance-Verläufe werden historische Marktpreise benötigt.</p>
                    </div>
                </article>
            </section>

            <article className={`${styles.card} ${styles.subtleCard}`}>
                <div className={styles.cardHead}><h2>Portfolio-Aufteilung</h2></div>
                <PortfolioBreakdown entries={metrics.portfolioBreakdown} />
            </article>

            {hasDividends ? (
                <article className={`${styles.card} ${styles.prominentCard}`}>
                    <div className={styles.cardHead}><h2>Dividenden</h2></div>
                    <div className={styles.metricGrid}>
                        <div><span>Gesamtsumme</span><strong>{formatCurrency(metrics.totalDividendNet)}</strong></div>
                        <div><span>Anzahl Zahlungen</span><strong>{asset.dividendCount}</strong></div>
                        <div><span>Portfolio-Scope</span><strong>Alle ausgewählten Portfolios</strong></div>
                        <div><span>Datenbasis</span><strong>Lokaler Stand</strong></div>
                    </div>
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
                <div className={styles.inlineEmpty}>Zu diesem Asset stehen lokale Aktivitäten im gewählten Portfolio-Scope bereit. Eine detaillierte Verlaufsauswertung folgt mit dem Marktpreis-Modul.</div>
            </article>
        </main>
    );
}
