"use client";

import { useEffect } from "react";
import type {
    AssetConsistencyCheck,
    ReconciliationWarning,
} from "../../lib/types";
import styles from "./DataWarningsPanel.module.css";

// ============================================================
// Props
// ============================================================

type DataWarningsPanelProps = {
    warnings: AssetConsistencyCheck[];
    reconciliationWarnings?: ReconciliationWarning[];
    isOpen: boolean;
    onCloseAction: () => void;
};

// ============================================================
// Lokale Helper
// ============================================================

function getSeverityClassName(severity: ReconciliationWarning["severity"]): string {
    if (severity === "error") {
        return styles.severityError;
    }

    if (severity === "warning") {
        return styles.severityWarning;
    }

    return styles.severityInfo;
}

function getSeverityLabel(severity: ReconciliationWarning["severity"]): string {
    if (severity === "error") {
        return "Fehler";
    }

    if (severity === "warning") {
        return "Warnung";
    }

    return "Info";
}

// ============================================================
// Komponente
// ============================================================

export default function DataWarningsPanel({
    warnings,
    reconciliationWarnings = [],
    isOpen,
    onCloseAction,
}: DataWarningsPanelProps) {
    const hasConsistencyWarnings = warnings.length > 0;
    const hasReconciliationWarnings = reconciliationWarnings.length > 0;
    const hasAnyWarnings = hasConsistencyWarnings || hasReconciliationWarnings;
    const totalWarnings = warnings.length + reconciliationWarnings.length;

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onCloseAction();
            }
        }

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onCloseAction]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    return (
        <aside className={styles.overlay} aria-modal="true" role="dialog">
            <button
                type="button"
                className={styles.backdrop}
                aria-label="Warnungsansicht schließen"
                onClick={onCloseAction}
            />

            <div className={styles.panel}>
                <div className={styles.header}>
                    <div>
                        <div className={styles.eyebrow}>Prüfhinweise</div>
                        <h2 className={styles.title}>Datenwarnungen</h2>
                        <div className={styles.subtitle}>
                            {hasAnyWarnings
                                ? `${totalWarnings} Hinweise aus Konsistenzprüfung und Reconciliation`
                                : "Aktuell wurden keine Auffälligkeiten erkannt."}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onCloseAction}
                        className={styles.closeButton}
                    >
                        Schließen
                    </button>
                </div>

                <div className={styles.summaryBar}>
                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Gesamt</span>
                        <strong className={styles.summaryValue}>{totalWarnings}</strong>
                    </div>

                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Konsistenz</span>
                        <strong className={styles.summaryValue}>{warnings.length}</strong>
                    </div>

                    <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Reconciliation</span>
                        <strong className={styles.summaryValue}>
                            {reconciliationWarnings.length}
                        </strong>
                    </div>
                </div>

                {!hasAnyWarnings ? (
                    <section className={styles.emptyState}>
                        <div className={styles.emptyStateTitle}>Keine Datenwarnungen vorhanden</div>
                        <div className={styles.emptyStateText}>
                            Die aktuelle bereinigte Pipeline hat keine Konsistenz- oder
                            Reconciliation-Auffälligkeiten erkannt.
                        </div>
                    </section>
                ) : null}

                {hasReconciliationWarnings ? (
                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <div>
                                <h3 className={styles.sectionTitle}>Reconciliation</h3>
                                <div className={styles.sectionSubtitle}>
                                    Technische Prüfhinweise auf Aktivitäts- und Bestandsbasis
                                </div>
                            </div>

                            <span className={styles.sectionCount}>
                                {reconciliationWarnings.length}
                            </span>
                        </div>

                        <div className={styles.list}>
                            {reconciliationWarnings.map((warning, index) => (
                                <article
                                    key={`${warning.isin}-${warning.severity}-${index}`}
                                    className={styles.item}
                                >
                                    <div className={styles.itemTopRow}>
                                        <div className={styles.itemAssetBlock}>
                                            <span className={styles.itemAssetPrimary}>
                                                {warning.isin}
                                            </span>
                                        </div>

                                        <span
                                            className={`${styles.severityBadge} ${getSeverityClassName(
                                                warning.severity
                                            )}`}
                                        >
                                            {getSeverityLabel(warning.severity)}
                                        </span>
                                    </div>

                                    <div className={styles.itemText}>{warning.message}</div>
                                </article>
                            ))}
                        </div>
                    </section>
                ) : null}

                {hasConsistencyWarnings ? (
                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <div>
                                <h3 className={styles.sectionTitle}>Konsistenz</h3>
                                <div className={styles.sectionSubtitle}>
                                    Rekonstruierte Bestände und Kostenbasis pro Asset
                                </div>
                            </div>

                            <span className={styles.sectionCount}>{warnings.length}</span>
                        </div>

                        <div className={styles.list}>
                            {warnings.map((warning) => (
                                <article key={warning.isin} className={styles.item}>
                                    <div className={styles.itemTopRow}>
                                        <div className={styles.itemAssetBlock}>
                                            <span className={styles.itemAssetPrimary}>
                                                {warning.name ?? warning.isin}
                                            </span>
                                            <span className={styles.itemAssetSecondary}>
                                                {warning.isin}
                                            </span>
                                        </div>
                                    </div>

                                    <div className={styles.metricRow}>
                                        <span>Bestand</span>
                                        <strong>{warning.reconstructedNetShares}</strong>
                                    </div>

                                    <div className={styles.metricRow}>
                                        <span>Kostenbasis</span>
                                        <strong>{warning.remainingCostBasis.toFixed(2)} €</strong>
                                    </div>

                                    <ul className={styles.warningList}>
                                        {warning.warnings.map((text, index) => (
                                            <li key={`${warning.isin}-${index}`}>{text}</li>
                                        ))}
                                    </ul>
                                </article>
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        </aside>
    );
}
