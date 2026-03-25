// src/components/dashboard/DataWarningsPanel.tsx

import type {
    AssetConsistencyCheck,
    ReconciliationWarning,
} from "../../lib/types";
import styles from "./DataWarningsPanel.module.css";

/**
 * ---------------------------------------------------------------------------
 * Props
 * ---------------------------------------------------------------------------
 */

type DataWarningsPanelProps = {
    warnings: AssetConsistencyCheck[];
    reconciliationWarnings?: ReconciliationWarning[];
};

/**
 * ---------------------------------------------------------------------------
 * Lokale Helper
 * ---------------------------------------------------------------------------
 */

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

/**
 * ---------------------------------------------------------------------------
 * Komponente
 * ---------------------------------------------------------------------------
 */

export default function DataWarningsPanel({
    warnings,
    reconciliationWarnings = [],
}: DataWarningsPanelProps) {
    const hasConsistencyWarnings = warnings.length > 0;
    const hasReconciliationWarnings = reconciliationWarnings.length > 0;
    const hasAnyWarnings = hasConsistencyWarnings || hasReconciliationWarnings;

    if (!hasAnyWarnings) {
        return (
            <section className={styles.panel}>
                <div className={styles.header}>
                    <h3 className={styles.title}>Datenwarnungen</h3>
                    <div className={styles.subtitle}>Aktuell wurden keine Auffälligkeiten erkannt.</div>
                </div>
            </section>
        );
    }

    return (
        <section className={styles.panel}>
            {/* ------------------------------------------------------------------ */}
            {/* Kopfbereich                                                        */}
            {/* ------------------------------------------------------------------ */}
            <div className={styles.header}>
                <h3 className={styles.title}>Datenwarnungen</h3>
                <div className={styles.subtitle}>
                    Konsistenz- und Reconciliation-Hinweise aus der bereinigten Pipeline
                </div>
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* Reconciliation-Warnungen                                            */}
            {/* ------------------------------------------------------------------ */}
            {hasReconciliationWarnings ? (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h4 className={styles.sectionTitle}>Reconciliation-Probleme</h4>
                        <span className={styles.sectionCount}>
                            {reconciliationWarnings.length}
                        </span>
                    </div>

                    <div className={styles.list}>
                        {reconciliationWarnings.map((warning, index) => (
                            <div
                                key={`${warning.isin}-${warning.severity}-${index}`}
                                className={styles.row}
                            >
                                <div className={styles.rowMain}>
                                    <div className={styles.rowHeadline}>
                                        <span className={styles.isinLabel}>{warning.isin}</span>

                                        <span
                                            className={`${styles.severityBadge} ${getSeverityClassName(
                                                warning.severity
                                            )}`}
                                        >
                                            {getSeverityLabel(warning.severity)}
                                        </span>
                                    </div>

                                    <div className={styles.rowText}>{warning.message}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {/* ------------------------------------------------------------------ */}
            {/* Konsistenzwarnungen                                                 */}
            {/* ------------------------------------------------------------------ */}
            {hasConsistencyWarnings ? (
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h4 className={styles.sectionTitle}>Konsistenzwarnungen</h4>
                        <span className={styles.sectionCount}>{warnings.length}</span>
                    </div>

                    <div className={styles.list}>
                        {warnings.map((warning) => (
                            <div key={warning.isin} className={styles.row}>
                                <div className={styles.rowMain}>
                                    <div className={styles.rowHeadline}>
                                        <span className={styles.assetName}>
                                            {warning.name ?? warning.isin}
                                        </span>
                                        <span className={styles.isinMeta}>{warning.isin}</span>
                                    </div>

                                    <div className={styles.metrics}>
                                        <span>Bestand: {warning.reconstructedNetShares}</span>
                                        <span>Kostenbasis: {warning.remainingCostBasis.toFixed(2)} €</span>
                                    </div>

                                    <ul className={styles.warningList}>
                                        {warning.warnings.map((text: string, index: number) => (
                                            <li key={`${warning.isin}-${index}`}>{text}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </section>
    );
}