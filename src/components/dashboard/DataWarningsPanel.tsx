import styles from "./DataWarningsPanel.module.css";
import type { AssetConsistencyCheck } from "../../lib/types";

type DataWarningsPanelProps = {
    warnings: AssetConsistencyCheck[];
};

export default function DataWarningsPanel({
    warnings,
}: DataWarningsPanelProps) {
    return (
        <section className={styles.card}>
            <div className={styles.header}>
                <div>
                    <h2 className={styles.title}>Datenwarnungen</h2>
                    <div className={styles.subtitle}>
                        Auffälligkeiten in der rekonstruierten Bestands- und Kostenbasislogik
                    </div>
                </div>

                <div className={styles.count}>{warnings.length} Asset(s)</div>
            </div>

            <div className={styles.list}>
                {warnings.map((warning) => (
                    <article key={warning.isin} className={styles.item}>
                        <div className={styles.itemTop}>
                            <div>
                                <div className={styles.assetName}>
                                    {warning.name ?? warning.isin}
                                </div>
                                <div className={styles.assetMeta}>{warning.isin}</div>
                            </div>

                            <div className={styles.flags}>
                                {warning.isNegativeShares ? (
                                    <span className={styles.flag}>Negativer Bestand</span>
                                ) : null}

                                {warning.isNegativeCostBasis ? (
                                    <span className={styles.flag}>Negative Kostenbasis</span>
                                ) : null}

                                {warning.hasZeroSharesButCostBasis ? (
                                    <span className={styles.flag}>Null-Bestand mit Kostenbasis</span>
                                ) : null}

                                {warning.hasSharesButNoBuyHistory ? (
                                    <span className={styles.flag}>Bestand ohne Käufe</span>
                                ) : null}

                                {warning.soldMoreThanBought ? (
                                    <span className={styles.flag}>Mehr verkauft als gekauft</span>
                                ) : null}
                            </div>
                        </div>

                        <div className={styles.metrics}>
                            <div className={styles.metric}>
                                <div className={styles.metricLabel}>Rekonstruierter Bestand</div>
                                <div className={styles.metricValue}>
                                    {warning.reconstructedNetShares.toLocaleString("de-DE", {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 6,
                                    })}
                                </div>
                            </div>

                            <div className={styles.metric}>
                                <div className={styles.metricLabel}>Verbleibende Kostenbasis</div>
                                <div className={styles.metricValue}>
                                    {warning.remainingCostBasis.toLocaleString("de-DE", {
                                        style: "currency",
                                        currency: "EUR",
                                    })}
                                </div>
                            </div>
                        </div>

                        <ul className={styles.warningList}>
                            {warning.warnings.map((text) => (
                                <li key={text} className={styles.warningItem}>
                                    {text}
                                </li>
                            ))}
                        </ul>
                    </article>
                ))}

                {warnings.length === 0 ? (
                    <div className={styles.empty}>Keine Datenwarnungen vorhanden.</div>
                ) : null}
            </div>
        </section>
    );
}