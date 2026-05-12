"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./ReportsPage.module.css";
import {
    loadLocalReportModel,
    type LocalReportModel,
    type ReportAssetRow,
} from "../../../lib/reporting";
import {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatShares,
} from "../../../lib/format";
import { useHydrationSafeLocalSnapshot } from "../../../hooks/use-hydration-safe-local-snapshot";

const REPORT_ASSET_REVEAL_STEP = 80;

function escapeCsvValue(value: string | number | null | undefined): string {
    const normalized = value == null ? "" : String(value);
    return `"${normalized.replaceAll('"', '""')}"`;
}

function buildAssetCsv(rows: ReportAssetRow[]): string {
    const header = [
        "Name",
        "ISIN",
        "Status",
        "Portfolios",
        "Bestand",
        "Gesamtwert EUR",
        "PnL EUR",
        "Dividenden EUR",
        "Letzte Aktivität",
    ];
    const body = rows.map((row) => [
        row.name,
        row.isin,
        row.status,
        row.portfolios,
        row.netShares ?? "",
        row.positionValue ?? "",
        row.unrealizedPnL ?? "",
        row.totalDividendNet ?? "",
        row.latestActivityAt ? formatDate(row.latestActivityAt) : "",
    ]);

    return [header, ...body]
        .map((columns) => columns.map(escapeCsvValue).join(";"))
        .join("\n");
}

function buildMarkdownSummary(report: LocalReportModel): string {
    return [
        "# AssetTrace Report v1",
        "",
        `Datenstand: ${formatDateTime(report.generatedAt)}`,
        `Scope: ${report.scopeLabel}`,
        "Hinweis: Alle Werte sind aus geladenen Daten berechnet, vorläufig und lokal exportiert.",
        "",
        "## Kennzahlen",
        `- Gesamtwert: ${formatCurrency(report.totals.totalPositionValue)}`,
        `- PnL: ${formatCurrency(report.totals.totalUnrealizedPnL)}`,
        `- Dividenden: ${formatCurrency(report.totals.totalDividendNet)}`,
        `- Assets: ${report.totals.activeAssets} aktiv / ${report.totals.closedAssets} geschlossen`,
        `- Datenqualität: ${report.quality.label}, ${report.quality.totalWarnings} Datenhinweis(e)`,
        "",
        "## Einschränkungen",
        "- Kein PDF in v1.",
        "- Kein Provider-Call durch Reports, Copy oder CSV-Export.",
        "- Exportiert werden nur sichtbare, geladene und sichere Report-Felder.",
    ].join("\n");
}

function downloadCsv(filename: string, csv: string): void {
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export default function ReportsPage() {
    const { value: report } = useHydrationSafeLocalSnapshot<LocalReportModel | null>(
        loadLocalReportModel,
        () => null,
    );
    const [copyStatus, setCopyStatus] = useState("");
    const [visibleAssetCount, setVisibleAssetCount] = useState(REPORT_ASSET_REVEAL_STEP);

    const markdownSummary = useMemo(() => {
        return report ? buildMarkdownSummary(report) : "";
    }, [report]);
    const visibleAssets = useMemo(() => {
        return report ? report.assets.slice(0, visibleAssetCount) : [];
    }, [report, visibleAssetCount]);

    async function copyMarkdownSummary() {
        if (!markdownSummary) return;

        try {
            await navigator.clipboard.writeText(markdownSummary);
            setCopyStatus("Markdown-Zusammenfassung lokal kopiert.");
        } catch {
            setCopyStatus("Kopieren nicht verfügbar. Browser-Berechtigung prüfen.");
        }
    }

    function exportCsv() {
        if (!report || report.assets.length === 0) return;

        downloadCsv("assettrace-report-assets.csv", buildAssetCsv(report.assets));
    }

    if (!report) {
        return (
            <main className="app-content">
                <section className={`ui-surface ${styles.emptyState}`}>
                    <p className={styles.eyebrow}>AssetTrace · Reports</p>
                    <h1>Keine geladenen Report-Daten</h1>
                    <p>
                        Reports v1 nutzt ausschließlich den lokal geladenen Dashboard-Stand. Bitte lade oder aktualisiere die Daten explizit im Dashboard. Diese Seite lädt keine Daten automatisch nach und löst keinen Provider-Call aus.
                    </p>
                    <div className="ui-banner ui-banner-info">
                        Export und Copy bleiben deaktiviert, bis sichtbare, geladene und sichere Felder aus dem Dashboard-Read-Model vorhanden sind.
                    </div>
                    <Link href="/dashboard" className="ui-btn ui-btn-primary">
                        Zum Dashboard
                    </Link>
                </section>
            </main>
        );
    }

    const canExport = report.assets.length > 0;
    const hasMoreAssets = visibleAssets.length < report.assets.length;

    return (
        <main className={`app-content ${styles.page}`}>
            <section className={`ui-surface ${styles.hero}`}>
                <div>
                    <p className={styles.eyebrow}>AssetTrace · Reports v1</p>
                    <h1 className={styles.title}>Lokaler Portfolio-Report</h1>
                    <p className={styles.description}>
                        Diese Übersicht ist aus geladenen Daten berechnet, vorläufig und read-only. Reports, Scope-Anwendung, Copy und CSV-Export bleiben lokal und starten keine automatische Nachladung.
                    </p>
                </div>
                <div className={styles.actions}>
                    <button
                        type="button"
                        className="ui-btn ui-btn-secondary"
                        onClick={copyMarkdownSummary}
                        disabled={!canExport}
                    >
                        Markdown kopieren
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn-primary"
                        onClick={exportCsv}
                        disabled={!canExport}
                    >
                        CSV exportieren
                    </button>
                    <div className={styles.copyStatus} aria-live="polite">
                        {copyStatus}
                    </div>
                </div>
            </section>

            {report.hasScopeMismatch ? (
                <div className="ui-banner ui-banner-info">
                    Der globale Portfolio-Scope weicht vom zuletzt geladenen Dashboard-Stand ab. Reports zeigen nur den lokal vorhandenen Schnitt; für einen neuen Stand bitte im Dashboard manuell aktualisieren.
                </div>
            ) : null}

            <section className={styles.metaGrid}>
                <div className={`ui-surface-soft ${styles.card}`}>
                    <span className={styles.label}>Datenstand</span>
                    <div className={styles.value}>{formatDateTime(report.generatedAt)}</div>
                    <div className={styles.note}>Keine automatische Nachladung beim Öffnen von Reports.</div>
                </div>
                <div className={`ui-surface-soft ${styles.card}`}>
                    <span className={styles.label}>Portfolio-Scope</span>
                    <div className={styles.value}>{report.selectedPortfolioIds.length}</div>
                    <div className={styles.note}>{report.scopeLabel}</div>
                </div>
                <div className={`ui-surface-soft ${styles.card}`}>
                    <span className={styles.label}>Datenbasis</span>
                    <div className={styles.value}>{report.cache.filteredActivityCount}</div>
                    <div className={styles.note}>Wertpapieraktivitäten aus dem geladenen Dashboard-Read-Model.</div>
                </div>
            </section>

            <section className={styles.tileGrid}>
                <div className={`ui-surface ${styles.tile}`}>
                    <span className={styles.label}>Gesamtwert</span>
                    <div className={styles.value}>{formatCurrency(report.totals.totalPositionValue)}</div>
                    <div className={styles.note}>Aus geladenen Positionswerten berechnet.</div>
                </div>
                <div className={`ui-surface ${styles.tile}`}>
                    <span className={styles.label}>PnL</span>
                    <div className={styles.value}>{formatCurrency(report.totals.totalUnrealizedPnL)}</div>
                    <div className={styles.note}>Vorläufig; keine verbindliche Performanceauswertung.</div>
                </div>
                <div className={`ui-surface ${styles.tile}`}>
                    <span className={styles.label}>Dividenden</span>
                    <div className={styles.value}>{formatCurrency(report.totals.totalDividendNet)}</div>
                    <div className={styles.note}>Netto-Dividenden aus geladenen Asset-Summaries.</div>
                </div>
                <div className={`ui-surface ${styles.tile}`}>
                    <span className={styles.label}>Warnungen</span>
                    <div className={styles.value}>{report.quality.totalWarnings}</div>
                    <div className={styles.note}>
                        {report.quality.totalWarnings > 0
                            ? `Datenqualität: ${report.quality.label}. Details unten.`
                            : "Keine Datenhinweise im geladenen Stand."}
                    </div>
                </div>
                <div className={`ui-surface ${styles.tile}`}>
                    <span className={styles.label}>Aktive Assets</span>
                    <div className={styles.value}>{report.totals.activeAssets}</div>
                    <div className={styles.note}>Bestand größer 0 im lokalen Scope.</div>
                </div>
                <div className={`ui-surface ${styles.tile}`}>
                    <span className={styles.label}>Geschlossene Assets</span>
                    <div className={styles.value}>{report.totals.closedAssets}</div>
                    <div className={styles.note}>Bestand 0 im lokalen Scope.</div>
                </div>
            </section>

            <section className={styles.breakdownGrid}>
                <div className={`ui-surface ${styles.card}`}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Warnungen / Datenqualität</h2>
                        <span className={styles.sectionMeta}>lokale Hinweise aus dem geladenen Stand</span>
                    </div>
                    <p className={styles.note}>
                        Normale UI zeigt keine Rohpayloads oder technischen Debugdaten. Bei Datenhinweisen bleibt der Report vorläufig; einzelne Werte können nicht verfügbar oder datenqualitätsbedingt eingeschränkt sein.
                    </p>
                    <div className={styles.qualityList}>
                        <div className={styles.qualityItem}><span>Konsistenzhinweise</span><strong>{report.quality.consistencyMessages}</strong></div>
                        <div className={styles.qualityItem}><span>Hinweis</span><strong>{report.quality.reconciliationInfo}</strong></div>
                        <div className={styles.qualityItem}><span>Prüfen</span><strong>{report.quality.reconciliationReview}</strong></div>
                        <div className={styles.qualityItem}><span>Eingeschränkt</span><strong>{report.quality.reconciliationCritical}</strong></div>
                    </div>
                </div>

                <div className={`ui-surface ${styles.card}`}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Portfolio-Breakdown</h2>
                        <span className={styles.sectionMeta}>{report.breakdown.length} Portfolio{report.breakdown.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className={styles.breakdownList}>
                        {report.breakdown.length === 0 ? (
                            <div className="ui-banner ui-banner-info">Portfolio-Breakdown ist für den aktuellen lokalen Scope nicht verfügbar.</div>
                        ) : report.breakdown.map((row) => (
                            <div key={row.portfolioName} className={styles.breakdownRow}>
                                <span>{row.portfolioName}</span>
                                <strong>{formatCurrency(row.positionValue)}</strong>
                                <span>{row.activeAssets} aktiv · {row.closedAssets} geschlossen</span>
                                <span>{formatCurrency(row.unrealizedPnL)} PnL · {formatCurrency(row.totalDividendNet)} Div.</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className={`ui-surface ${styles.card}`}>
                <div className={styles.sectionHeader}>
                    <div>
                        <h2 className={styles.sectionTitle}>Asset-Übersicht</h2>
                        <div className={styles.sectionMeta}>
                            {visibleAssets.length} von {report.assets.length} lokalen Asset-Zeilen angezeigt.
                            CSV enthält dieselben sicheren Report-Felder für den geladenen Datenbestand.
                        </div>
                    </div>
                </div>
                {report.assets.length === 0 ? (
                    <div className="ui-banner ui-banner-info">
                        Für den aktuellen globalen Scope sind im lokalen Dashboard-Stand keine exportierbaren Assets vorhanden.
                    </div>
                ) : (
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Asset</th>
                                    <th>Status</th>
                                    <th>Portfolios</th>
                                    <th>Bestand</th>
                                    <th>Gesamtwert</th>
                                    <th>PnL</th>
                                    <th>Dividenden</th>
                                    <th>Letzte Aktivität</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleAssets.map((row) => (
                                    <tr key={`${row.isin}-${row.status}`}>
                                        <td>
                                            <div className={styles.assetName}>{row.name}</div>
                                            <div className={styles.assetMeta}>{row.isin}</div>
                                        </td>
                                        <td>{row.status}</td>
                                        <td>{row.portfolios || "nicht verfügbar"}</td>
                                        <td>{formatShares(row.netShares)}</td>
                                        <td>{formatCurrency(row.positionValue)}</td>
                                        <td>{formatCurrency(row.unrealizedPnL)}</td>
                                        <td>{formatCurrency(row.totalDividendNet)}</td>
                                        <td>{formatDate(row.latestActivityAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {hasMoreAssets ? (
                            <div className={styles.revealFooter}>
                                <span>
                                    Report-Kennzahlen und Export bleiben auf den vollständigen lokal geladenen
                                    Report bezogen.
                                </span>
                                <button
                                    type="button"
                                    className="ui-btn ui-btn-secondary"
                                    onClick={() =>
                                        setVisibleAssetCount((count) => count + REPORT_ASSET_REVEAL_STEP)
                                    }
                                >
                                    Mehr lokale Asset-Zeilen anzeigen ({Math.min(REPORT_ASSET_REVEAL_STEP, report.assets.length - visibleAssets.length)} weitere)
                                </button>
                            </div>
                        ) : null}
                    </div>
                )}
            </section>
        </main>
    );
}
