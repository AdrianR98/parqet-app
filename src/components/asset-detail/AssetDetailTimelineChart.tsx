"use client";

import { useMemo, useState } from "react";
import type { AssetDetailWarning, ScopedAssetMetrics } from "../../lib/asset-detail";
import type { GlobalAssetViewModel } from "../../lib/types";
import { formatCurrency } from "../../lib/format";
import styles from "./AssetDetailTimelineChart.module.css";

type TimelineCategory = "buy" | "sell" | "dividend" | "transfer" | "warning" | "summary";
type TimelineRange = "1M" | "3M" | "6M" | "1J" | "3J" | "Max";
type ChartMode = "price" | "position" | "performance";

type TimelineEvent = {
    id: string;
    category: TimelineCategory;
    date: string;
    title: string;
    detail: string;
    portfolioContext?: string;
    qualityNote?: string;
};

type TimelineCluster = {
    id: string;
    events: TimelineEvent[];
    left: number;
    label: string;
};

const RANGE_OPTIONS: TimelineRange[] = ["1M", "3M", "6M", "1J", "3J", "Max"];

const CATEGORY_META: Record<TimelineCategory, { label: string; icon: string }> = {
    buy: { label: "Kauf", icon: "+" },
    sell: { label: "Verkauf", icon: "−" },
    dividend: { label: "Dividende", icon: "€" },
    transfer: { label: "Transfer/Buchung", icon: "↔" },
    warning: { label: "Datenhinweis", icon: "!" },
    summary: { label: "Lokaler Ereignisstand", icon: "•" },
};

const MODE_META: Record<ChartMode, { label: string; disabledReason: string }> = {
    price: {
        label: "Kurs",
        disabledReason: "Keine sichere lokale Kurs-Zeitserie im Dashboard-Read-Model verfügbar.",
    },
    position: {
        label: "Positionswert",
        disabledReason: "Keine sichere lokale Positionswert-Zeitserie im Dashboard-Read-Model verfügbar.",
    },
    performance: {
        label: "Performance",
        disabledReason: "Performance wird ohne geeignete lokale Historie nicht künstlich berechnet.",
    },
};

function parseTime(value: string | null | undefined): number | null {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
}

function formatDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

function formatDateTime(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function subtractRange(anchor: Date, range: TimelineRange): number | null {
    if (range === "Max") return null;

    const start = new Date(anchor);

    if (range === "1M") start.setMonth(start.getMonth() - 1);
    if (range === "3M") start.setMonth(start.getMonth() - 3);
    if (range === "6M") start.setMonth(start.getMonth() - 6);
    if (range === "1J") start.setFullYear(start.getFullYear() - 1);
    if (range === "3J") start.setFullYear(start.getFullYear() - 3);

    return start.getTime();
}

function getPortfolioContext(metrics: ScopedAssetMetrics): string | undefined {
    if (metrics.portfolioBreakdown.length === 0) return undefined;

    const names = metrics.portfolioBreakdown.map((entry) => entry.portfolioName).filter(Boolean);

    if (names.length <= 2) {
        return names.join(", ");
    }

    return `${names.slice(0, 2).join(", ")} + ${names.length - 2} weitere`;
}

function buildTimelineEvents(params: {
    asset: GlobalAssetViewModel;
    metrics: ScopedAssetMetrics;
    warnings: AssetDetailWarning[];
}): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    const portfolioContext = getPortfolioContext(params.metrics);

    if (parseTime(params.asset.latestActivityAt) != null) {
        const parts = [
            params.asset.buyCount > 0 ? `${params.asset.buyCount} Käufe` : null,
            params.asset.sellCount > 0 ? `${params.asset.sellCount} Verkäufe` : null,
            params.asset.dividendCount > 0 ? `${params.asset.dividendCount} Dividenden` : null,
        ].filter(Boolean);

        events.push({
            id: "latest-local-activity",
            category: "summary",
            date: params.asset.latestActivityAt!,
            title: "Letzter lokaler Ereignisstand",
            detail:
                parts.length > 0
                    ? `Das Dashboard-Read-Model enthält aggregiert: ${parts.join(", ")}. Einzelne Activity-Zeitpunkte sind lokal noch nicht als Detail-Timeline gespeichert.`
                    : "Das Dashboard-Read-Model enthält einen letzten Aktivitätszeitpunkt, aber keine sichere Activity-Aufschlüsselung für die Detail-Timeline.",
            portfolioContext,
            qualityNote: "Marker aus lokalem Summary-Read-Model; kein Provider-Nachladen.",
        });
    }

    params.warnings.forEach((warning, index) => {
        if (parseTime(warning.occurredAt) == null) return;

        events.push({
            id: `warning-${index}`,
            category: "warning",
            date: warning.occurredAt!,
            title: warning.label,
            detail: warning.message,
            portfolioContext,
            qualityNote: warning.source,
        });
    });

    return events.sort((a, b) => (parseTime(a.date) ?? 0) - (parseTime(b.date) ?? 0));
}

function clusterEvents(events: TimelineEvent[], minTime: number, maxTime: number): TimelineCluster[] {
    if (events.length === 0) return [];

    const span = Math.max(maxTime - minTime, 1);
    const clusters: TimelineCluster[] = [];

    for (const event of events) {
        const time = parseTime(event.date) ?? minTime;
        const left = Math.min(96, Math.max(4, ((time - minTime) / span) * 92 + 4));
        const current = clusters[clusters.length - 1];

        if (current && Math.abs(current.left - left) < 7) {
            current.events.push(event);
            current.left = (current.left * (current.events.length - 1) + left) / current.events.length;
            current.label = `${current.events.length} Ereignisse`;
        } else {
            clusters.push({
                id: event.id,
                events: [event],
                left,
                label: CATEGORY_META[event.category].label,
            });
        }
    }

    return clusters;
}

export function AssetDetailTimelineChart({
    asset,
    metrics,
    warnings,
}: {
    asset: GlobalAssetViewModel;
    metrics: ScopedAssetMetrics;
    warnings: AssetDetailWarning[];
}) {
    const [range, setRange] = useState<TimelineRange>("Max");
    const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

    const events = useMemo(() => buildTimelineEvents({ asset, metrics, warnings }), [asset, metrics, warnings]);
    const availableMode: ChartMode | null = null;
    const selectedMode: ChartMode = availableMode ?? "price";

    const timeline = useMemo(() => {
        const eventTimes = events.map((event) => parseTime(event.date)).filter((time): time is number => time != null);
        const fallbackTime = parseTime(asset.latestActivityAt) ?? 0;
        const maxTime = eventTimes.length > 0 ? Math.max(...eventTimes) : fallbackTime;
        const minEventTime = eventTimes.length > 0 ? Math.min(...eventTimes) : maxTime;
        const rangeStart = subtractRange(new Date(maxTime), range);
        const filtered = events.filter((event) => {
            const time = parseTime(event.date);
            return time != null && (rangeStart == null || time >= rangeStart);
        });
        const minTime = rangeStart ?? minEventTime;
        const clusters = clusterEvents(filtered, minTime, maxTime);

        return { clusters, filtered, minTime, maxTime };
    }, [asset.latestActivityAt, events, range]);

    const selectedCluster =
        timeline.clusters.find((cluster) => cluster.id === selectedClusterId) ?? timeline.clusters[0] ?? null;
    const hasEvents = events.length > 0;
    const hasFilteredEvents = timeline.filtered.length > 0;

    return (
        <div className={styles.timelineShell} aria-label="Assetdetail-Timeline">
            <div className={styles.toolbar}>
                <div className={styles.rangeGroup} aria-label="Zeitraum wählen">
                    {RANGE_OPTIONS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            className={option === range ? styles.activeRangeButton : styles.rangeButton}
                            onClick={() => {
                                setRange(option);
                                setSelectedClusterId(null);
                            }}
                        >
                            {option}
                        </button>
                    ))}
                </div>

                <div className={styles.modeGroup} aria-label="Chart-Modus">
                    {(Object.keys(MODE_META) as ChartMode[]).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            className={mode === selectedMode && availableMode ? styles.activeModeButton : styles.modeButton}
                            disabled={mode !== availableMode}
                            title={mode === availableMode ? undefined : MODE_META[mode].disabledReason}
                        >
                            {MODE_META[mode].label}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.chartStage}>
                <div className={styles.chartBackdrop} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>

                <div className={styles.axis} aria-hidden="true" />

                {hasFilteredEvents ? (
                    <div className={styles.markerLayer}>
                        {timeline.clusters.map((cluster) => {
                            const primaryCategory = cluster.events[0]?.category ?? "summary";
                            const isCluster = cluster.events.length > 1;

                            return (
                                <button
                                    key={cluster.id}
                                    type="button"
                                    className={`${styles.marker} ${styles[primaryCategory]} ${
                                        selectedCluster?.id === cluster.id ? styles.selectedMarker : ""
                                    }`}
                                    style={{ left: `${cluster.left}%` }}
                                    onClick={() => setSelectedClusterId(cluster.id)}
                                    aria-label={`${cluster.label} am ${formatDate(cluster.events[0].date)} anzeigen`}
                                >
                                    <span>{isCluster ? cluster.events.length : CATEGORY_META[primaryCategory].icon}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className={styles.emptyOverlay}>
                        <strong>
                            {hasEvents
                                ? "Für diesen Zeitraum liegen keine lokalen Timeline-Ereignisse vor."
                                : "Für dieses Asset liegen noch keine lokalen Ereignisdaten vor."}
                        </strong>
                        <span>Es werden keine Daten automatisch nachgeladen.</span>
                        <span>Lade oder aktualisiere Daten explizit im Dashboard.</span>
                    </div>
                )}

                {hasEvents ? (
                    <div className={styles.axisLabels} aria-hidden="true">
                        <span>{formatDate(new Date(timeline.minTime).toISOString())}</span>
                        <span>{formatDate(new Date(timeline.maxTime).toISOString())}</span>
                    </div>
                ) : null}
            </div>

            <div className={styles.detailGrid}>
                <section className={styles.inspectPanel} aria-live="polite">
                    <div className={styles.panelHeader}>
                        <strong>{selectedCluster ? selectedCluster.label : "Timeline"}</strong>
                        <span>{hasFilteredEvents ? `${timeline.filtered.length} lokale Marker` : "Marker-only-Fallback"}</span>
                    </div>

                    {selectedCluster ? (
                        <div className={styles.eventStack}>
                            {selectedCluster.events.map((event) => (
                                <article key={event.id} className={styles.eventCard}>
                                    <div className={`${styles.eventIcon} ${styles[event.category]}`}>
                                        {CATEGORY_META[event.category].icon}
                                    </div>
                                    <div>
                                        <strong>{event.title}</strong>
                                        <span>{formatDateTime(event.date)}</span>
                                        <p>{event.detail}</p>
                                        {event.portfolioContext ? (
                                            <small>Portfolio-Kontext: {event.portfolioContext}</small>
                                        ) : null}
                                        {event.qualityNote ? <small>Datenqualität: {event.qualityNote}</small> : null}
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.fallbackCopy}>
                            <p>
                                Die Detailseite nutzt nur den lokalen Dashboard-Cache. Eine vollständige Activity-Timeline
                                wird erst angezeigt, wenn sichere lokale Ereignispunkte verfügbar sind.
                            </p>
                        </div>
                    )}
                </section>

                <aside className={styles.contextPanel}>
                    <strong>Lokale Datenbasis</strong>
                    <dl>
                        <div>
                            <dt>Käufe</dt>
                            <dd>{asset.buyCount}</dd>
                        </div>
                        <div>
                            <dt>Verkäufe</dt>
                            <dd>{asset.sellCount}</dd>
                        </div>
                        <div>
                            <dt>Dividenden</dt>
                            <dd>{asset.dividendCount}</dd>
                        </div>
                        <div>
                            <dt>Positionswert</dt>
                            <dd>{formatCurrency(metrics.positionValue)}</dd>
                        </div>
                    </dl>
                    <p>
                        Chart-Modi bleiben deaktiviert, bis lokal belastbare Zeitserien vorhanden sind. Range-Wechsel
                        filtern ausschließlich vorhandene Marker im Browser.
                    </p>
                </aside>
            </div>

            <div className={styles.legend} aria-label="Markerarten">
                {(Object.keys(CATEGORY_META) as TimelineCategory[])
                    .filter((category) => category !== "summary")
                    .map((category) => (
                        <span key={category}>
                            <i className={`${styles.legendDot} ${styles[category]}`} aria-hidden="true" />
                            {CATEGORY_META[category].label}
                        </span>
                    ))}
            </div>
        </div>
    );
}

