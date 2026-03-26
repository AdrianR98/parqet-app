"use client";

import { useEffect } from "react";
import styles from "./DataWarningsPanel.module.css";
import type {
    AssetConsistencyCheck,
    ReconciliationWarning,
} from "../../lib/types";

type DataWarningsPanelProps = {
    warnings: AssetConsistencyCheck[];
    reconciliationWarnings: ReconciliationWarning[];
    isOpen: boolean;
    onCloseAction: () => void;
};

/**
 * ============================================================
 * COMPONENT: DATA WARNINGS PANEL
 * ============================================================
 *
 * Rolle:
 * - rechter Drawer für Daten- und Reconciliation-Warnungen
 * - globale ui-* Buttons / Banner wo sinnvoll
 * - lokales CSS nur für Drawer-Struktur und Listenlayout
 *
 * Typische Erweiterungspunkte:
 * - Filter nach Severity
 * - Gruppierung nach Asset
 * - Direktlink zum Asset / Audit
 * - Acknowledge / Ignore Status
 */
export default function DataWarningsPanel({
    warnings,
    reconciliationWarnings,
    isOpen,
    onCloseAction,
}: DataWarningsPanelProps) {
    useEffect(() => {
        if (!isOpen) return;

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onCloseAction();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onCloseAction]);

    if (!isOpen) {
        return null;
    }

    const totalCount = warnings.length + reconciliationWarnings.length;

    return (
        <aside className={styles.overlay} onClick={onCloseAction}>
            <div
                className={styles.panel}
                onClick={(event) => event.stopPropagation()}
            >
                {/* =====================================================
                    HEADER
                ===================================================== */}
                <div className={styles.header}>
                    <div>
                        <div className={styles.eyebrow}>Prüfhinweise</div>
                        <h2 className={styles.title}>Datenwarnungen</h2>
                        <div className={styles.metaRow}>
                            <span>{totalCount} Hinweise gesamt</span>
                            <span>·</span>
                            <span>{warnings.length} Konsistenzwarnungen</span>
                            <span>·</span>
                            <span>{reconciliationWarnings.length} Reconciliation-Warnungen</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="ui-btn ui-btn-secondary"
                        onClick={onCloseAction}
                    >
                        Schließen
                    </button>
                </div>

                {/* =====================================================
                    LEERZUSTAND
                ===================================================== */}
                {totalCount === 0 ? (
                    <div className="ui-banner ui-banner-info">
                        Aktuell liegen keine Datenwarnungen vor.
                    </div>
                ) : null}

                {/* =====================================================
                    KONSISTENZWARNUNGEN
                ===================================================== */}
                {warnings.length > 0 ? (
                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h3 className={styles.sectionTitle}>Konsistenzwarnungen</h3>
                            <div className={styles.sectionMeta}>
                                {warnings.length} Asset
                                {warnings.length === 1 ? "" : "s"} betroffen
                            </div>
                        </div>

                        <div className={styles.list}>
                            {warnings.map((warning) => (
                                <article
                                    key={`${warning.isin}-${warning.name ?? "unknown"}`}
                                    className={`ui-surface-soft ${styles.warningCard}`}
                                >
                                    <div className={styles.warningTop}>
                                        <div className={styles.warningIdentity}>
                                            <strong>{warning.name ?? warning.isin}</strong>
                                            <span className={styles.warningMeta}>
                                                {warning.isin}
                                            </span>
                                        </div>
                                    </div>

                                    <div className={styles.flagGrid}>
                                        <span>
                                            Rekonstr. Bestand:{" "}
                                            <strong>{warning.reconstructedNetShares}</strong>
                                        </span>
                                        <span>
                                            Cost Basis:{" "}
                                            <strong>{warning.remainingCostBasis}</strong>
                                        </span>
                                    </div>

                                    <div className={styles.messageList}>
                                        {warning.warnings.map((entry, index) => (
                                            <div
                                                key={`${warning.isin}-consistency-${index}`}
                                                className={styles.messageItem}
                                            >
                                                {entry}
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                ) : null}

                {/* =====================================================
                    RECONCILIATION WARNINGS
                ===================================================== */}
                {reconciliationWarnings.length > 0 ? (
                    <section className={styles.section}>
                        <div className={styles.sectionHeader}>
                            <h3 className={styles.sectionTitle}>Reconciliation-Warnungen</h3>
                            <div className={styles.sectionMeta}>
                                {reconciliationWarnings.length} Hinweis
                                {reconciliationWarnings.length === 1 ? "" : "e"}
                            </div>
                        </div>

                        <div className={styles.list}>
                            {reconciliationWarnings.map((warning, index) => (
                                <article
                                    key={`${warning.isin}-${warning.message}-${index}`}
                                    className={`ui-surface-soft ${styles.warningCard}`}
                                >
                                    <div className={styles.warningTop}>
                                        <div className={styles.warningIdentity}>
                                            <strong>{warning.isin}</strong>
                                            <span
                                                className={`${styles.severityBadge} ${warning.severity === "error"
                                                        ? styles.severityError
                                                        : warning.severity === "warning"
                                                            ? styles.severityWarning
                                                            : styles.severityInfo
                                                    }`}
                                            >
                                                {warning.severity}
                                            </span>
                                        </div>
                                    </div>

                                    <div className={styles.messageList}>
                                        <div className={styles.messageItem}>
                                            {warning.message}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        </aside>
    );
}