"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { loadPortfolioScope, resolvePortfolioScope } from "../../../lib/app-settings";
import { loadDashboardCache } from "../../../lib/dashboard-cache";
import {
    createAssetDetailHref,
    findAssetByKey,
    getAssetDetailKey,
    getAssetDisplayName,
    getAssetInitials,
    getAssetLogoUrl,
    getAssetStatusLabel,
    getAssetWarnings,
    scopeAssetMetrics,
} from "../../../lib/asset-detail";
import { enrichAssetsWithMetadata } from "../../../lib/asset-metadata";
import { AssetDetailTimelineChart } from "../../../components/asset-detail/AssetDetailTimelineChart";
import { formatCurrency, formatShares } from "../../../lib/format";
import type { AssetSummary, PortfolioPosition } from "../../../lib/types";
import styles from "./AssetDetailPage.module.css";

type MetricCard = {
    label: string;
    value: string;
    note?: string;
};

type AssetDetailViewModel =
    | { state: "missing-key" }
    | { state: "no-cache" }
    | { state: "not-found"; lastUpdatedAt: string | null }
    | {
        state: "ready";
        asset: AssetSummary;
        canonicalHref: string | null;
        metrics: ReturnType<typeof scopeAssetMetrics>;
        warnings: ReturnType<typeof getAssetWarnings>;
        lastUpdatedAt: string | null;
    };

function formatDate(value: string | null | undefined): string {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function formatNullableNumber(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
        return "—";
    }

    return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
}

function EmptyState({ title, message }: { title: string; message: string }) {
    return (
        <section className={styles.stateBox}>
            <strong>{title}</strong>
            <p>{message}</p>
            <Link href="/dashboard" className="ui-btn ui-btn-secondary">
                Zurück zum Dashboard
            </Link>
        </section>
    );
}

function MetricGrid({ items }: { items: MetricCard[] }) {
    return (
        <div className={styles.metricGrid}>
            {items.map((item) => (
                <div key={item.label} className={styles.metricCard}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    {item.note ? <small>{item.note}</small> : null}
                </div>
            ))}
        </div>
    );
}

function PortfolioBreakdown({ entries }: { entries: PortfolioPosition[] }) {
    if (entries.length === 0) {
        return (
            <div className={styles.inlineEmpty}>
                Für den aktuellen Portfolio-Scope sind keine lokalen Portfolio-Daten geladen.
            </div>
        );
    }

    return (
        <div className={styles.breakdownList}>
            {entries.map((entry) => (
                <details key={entry.portfolioId} className={styles.breakdownItem}>
                    <summary>
                        <span>{entry.portfolioName}</span>
                        <strong>{formatCurrency(entry.positionValue)}</strong>
                    </summary>
                    <div className={styles.breakdownMetrics}>
                        <span>Stückzahl: {formatShares(entry.netShares)}</span>
                        <span>Ø Kaufpreis: {formatCurrency(entry.avgBuyPrice)}</span>
                        <span>Unrealized PnL: {formatCurrency(entry.unrealizedPnL)}</span>
                        <span>Dividenden: {formatCurrency(entry.totalDividendNet)}</span>
                    </div>
                </details>
            ))}
        </div>
    );
}

function buildScopedPortfolioIds(asset: AssetSummary, loadedPortfolioIds: string[]): string[] {
    const scope = loadPortfolioScope();
    const loadedIds = loadedPortfolioIds.length > 0 ? loadedPortfolioIds : asset.portfolioIds;
    const resolved = resolvePortfolioScope(
        scope,
        loadedIds.map((id) => ({ id }))
    );

    return resolved.selectedPortfolioIds.filter((id) => asset.portfolioIds.includes(id));
}

function subscribeToLocalAssetState(onStoreChange: () => void) {
    if (typeof window === "undefined") {
        return () => {};
    }

    window.addEventListener("storage", onStoreChange);

    return () => window.removeEventListener("storage", onStoreChange);
}

function getLocalAssetStateSnapshot(): boolean {
    return true;
}

function getLocalAssetStateServerSnapshot(): boolean {
    return false;
}

export default function AssetDetailPage() {
    const searchParams = useSearchParams();
    const assetKey = searchParams.get("id")?.trim() ?? "";
    const canReadLocalState = useSyncExternalStore(
        subscribeToLocalAssetState,
        getLocalAssetStateSnapshot,
        getLocalAssetStateServerSnapshot,
    );

    const viewModel = useMemo<AssetDetailViewModel>(() => {
        if (!assetKey) {
            return { state: "missing-key" as const };
        }

        if (!canReadLocalState) {
            return { state: "no-cache" as const };
        }

        const cache = loadDashboardCache();

        if (!cache) {
            return { state: "no-cache" as const };
        }

        const assets = enrichAssetsWithMetadata([
            ...(cache.activeAssets ?? []),
            ...(cache.closedAssets ?? []),
        ]);
        const asset = findAssetByKey(assets, assetKey);

        if (!asset) {
            return { state: "not-found" as const, lastUpdatedAt: cache.lastUpdatedAt };
        }

        const selectedPortfolioIds = buildScopedPortfolioIds(asset, cache.selectedPortfolioIds ?? []);
        const metrics = scopeAssetMetrics(asset, selectedPortfolioIds);
        const warnings = getAssetWarnings({
            asset,
            consistencyReport: cache.consistencyReport ?? null,
            reconciliationWarnings: cache.reconciliationWarnings ?? [],
        });

        return {
            state: "ready" as const,
            asset,
            canonicalHref: createAssetDetailHref(asset),
            metrics,
            warnings,
            lastUpdatedAt: cache.lastUpdatedAt ?? cache.generatedAt ?? null,
        };
    }, [assetKey, canReadLocalState]);

    if (viewModel.state === "missing-key") {
        return (
            <main className={styles.page}>
                <EmptyState
                    title="Asset-Key fehlt"
                    message="Die Assetdetail-Seite benötigt den stabilen Asset-Key als Query-Parameter, zum Beispiel ?id=IE00B8GKDB10. Es wurde kein Provider-Request ausgelöst."
                />
            </main>
        );
    }

    if (viewModel.state === "no-cache") {
        return (
            <main className={styles.page}>
                <EmptyState
                    title="Assetdaten noch nicht geladen"
                    message="Bitte Dashboard-Daten explizit laden oder aktualisieren. Die Detailseite verwendet nur lokale Dashboard-Daten und lädt keine Daten automatisch nach."
                />
            </main>
        );
    }

    if (viewModel.state === "not-found") {
        return (
            <main className={styles.page}>
                <EmptyState
                    title="Asset nicht gefunden"
                    message="Dieses Asset ist in den lokal geladenen Dashboard-Daten nicht vorhanden. Bitte Dashboard-Daten explizit laden oder aktualisieren."
                />
            </main>
        );
    }

    const { asset, metrics, warnings } = viewModel;
    const displayName = getAssetDisplayName(asset);
    const logoUrl = getAssetLogoUrl(asset);
    const statusLabel = getAssetStatusLabel(metrics);
    const assetKeyLabel = getAssetDetailKey(asset);

    const overviewItems: MetricCard[] = [
        { label: "Portfolios im Scope", value: formatNullableNumber(metrics.portfolioCount) },
        { label: "Aktivitäten lokal", value: formatNullableNumber(asset.activityCount) },
        { label: "Käufe / Verkäufe", value: `${asset.buyCount} / ${asset.sellCount}` },
        { label: "Letzte Aktivität", value: formatDate(asset.latestActivityAt) },
    ];

    const positionItems: MetricCard[] = [
        { label: "Stückzahl", value: formatShares(metrics.netShares) },
        { label: "Positionswert", value: formatCurrency(metrics.positionValue) },
        { label: "Einstand", value: formatCurrency(metrics.remainingCostBasis) },
        { label: "Ø Kaufpreis", value: formatCurrency(metrics.avgBuyPrice) },
        { label: "Unrealized PnL", value: formatCurrency(metrics.unrealizedPnL) },
    ];

    const dividendItems: MetricCard[] = [
        { label: "Gesamtsumme Dividenden", value: formatCurrency(metrics.totalDividendNet) },
        { label: "Anzahl Zahlungen", value: formatNullableNumber(asset.dividendCount) },
        {
            label: "Letzte Dividende",
            value: "—",
            note: "Im lokalen Summary-Read-Model noch nicht sicher verfügbar.",
        },
        {
            label: "Jahresübersicht",
            value: "Vorbereitet",
            note: "Keine Prognose und kein Nachladen in v1.",
        },
    ];

    return (
        <main className={styles.page}>
            <div className={styles.breadcrumbRow}>
                <Link href="/dashboard" className="ui-btn ui-btn-ghost">
                    ← Dashboard
                </Link>
                {viewModel.canonicalHref ? (
                    <Link href={viewModel.canonicalHref} className={styles.canonicalLink}>
                        kanonische Asset-URL
                    </Link>
                ) : null}
            </div>

            <section className={styles.hero}>
                <div className={styles.assetMark}>
                    {logoUrl ? (
                        <Image src={logoUrl} alt="" width={64} height={64} />
                    ) : (
                        <span>{getAssetInitials(asset)}</span>
                    )}
                </div>

                <div className={styles.heroText}>
                    <div className={styles.kicker}>Assetdetail · read-only Foundation</div>
                    <h1>{displayName}</h1>
                    <div className={styles.metaLine}>
                        <span>ISIN {asset.isin || assetKeyLabel}</span>
                        {asset.symbol ? <span>Symbol {asset.symbol}</span> : null}
                        {asset.ticker ? <span>Ticker {asset.ticker}</span> : null}
                        {asset.wkn ? <span>WKN {asset.wkn}</span> : null}
                    </div>
                </div>

                <aside className={styles.heroStatus}>
                    <span className={styles.statusPill}>{statusLabel}</span>
                    <span>Datenstand: {formatDate(viewModel.lastUpdatedAt)}</span>
                    <span>Globaler Portfolio-Scope lokal angewendet</span>
                </aside>
            </section>

            <section className={styles.scopeNotice}>
                Diese Seite nutzt ausschließlich bereits geladene Dashboard-Read-Models. Beim Öffnen
                werden keine Parqet-Provider-Calls, keine Audit-Route und kein Activity-Full-Fetch
                ausgelöst.
            </section>

            <div className={styles.sectionGrid}>
                <section className={styles.card}>
                    <div className={styles.sectionHeader}>
                        <h2>Übersicht</h2>
                        <p>Kompakte Kernkennzahlen aus lokalen AssetSummary-Daten.</p>
                    </div>
                    <MetricGrid items={overviewItems} />
                </section>

                <section className={styles.card}>
                    <div className={styles.sectionHeader}>
                        <h2>Position</h2>
                        <p>Scope-bewusste Positionswerte aus dem vorhandenen Portfolio-Breakdown.</p>
                    </div>
                    <MetricGrid items={positionItems} />
                </section>

                <section className={styles.card}>
                    <div className={styles.sectionHeader}>
                        <h2>Dividenden-Summary</h2>
                        <p>Nur lokal sichere Werte; keine Dividendenprognose in v1.</p>
                    </div>
                    <MetricGrid items={dividendItems} />
                </section>

                <section className={styles.card}>
                    <div className={styles.sectionHeader}>
                        <h2>Portfolio-Breakdown</h2>
                        <p>Globale Asset-Sicht über die geladenen Portfolios im aktuellen Scope.</p>
                    </div>
                    <PortfolioBreakdown entries={metrics.portfolioBreakdown} />
                </section>

                <section className={styles.card}>
                    <div className={styles.sectionHeader}>
                        <h2>Warnungen / Datenqualität</h2>
                        <p>Assetbezogene Datenhinweise aus dem geladenen Stand, ohne Rohpayloads oder private Debugdaten.</p>
                    </div>
                    {warnings.length > 0 ? (
                        <div className={styles.warningList}>
                            {warnings.map((warning, index) => (
                                <div key={`${warning.message}-${index}`} className={styles.warningItem}>
                                    <span>{warning.label}</span>
                                    <strong>{warning.message}</strong>
                                    <small>{warning.source}</small>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.inlineEmpty}>Keine assetbezogenen Datenhinweise im geladenen Stand.</div>
                    )}
                </section>

                <section className={`${styles.card} ${styles.timelineCard}`}>
                    <div className={styles.sectionHeader}>
                        <h2>Asset-Timeline</h2>
                        <p>Lokale Marker-Visualisierung ohne Provider-Nachladen oder externe Kursdaten.</p>
                    </div>
                    <AssetDetailTimelineChart asset={asset} metrics={metrics} warnings={warnings} />
                </section>
            </div>
        </main>
    );
}
