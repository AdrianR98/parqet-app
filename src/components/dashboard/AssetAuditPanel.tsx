// ============================================================
// src/components/dashboard/AssetAuditPanel.tsx
// ------------------------------------------------------------
// Read-only Audit-Panel fuer ein einzelnes Asset.
//
// Zeigt:
// - Basisinformationen
// - Reconciliation-Warnungen
// - normalisierte Activities
//
// Noch bewusst OHNE Schreiblogik / Overrides.
// ============================================================

"use client";

import styles from "./AssetAuditPanel.module.css";
import type { ActivitiesAuditApiResponse, AssetSummary } from "../../lib/types";
import { formatCurrency } from "../../lib/format";

type AssetAuditPanelProps = {
    asset: AssetSummary | null;
    data: ActivitiesAuditApiResponse | null;
    loading: boolean;
    error: string | null;
    isOpen: boolean;
    onCloseAction: () => void;
};

export default function AssetAuditPanel({
    asset,
    data,
    loading,
    error,
    isOpen,
    onCloseAction,
}: AssetAuditPanelProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <aside className={styles.overlay}>
            <div className={styles.panel}>
                <div className={styles.header}>
                    <div>
                        <div className={styles.eyebrow}>Asset Audit</div>
                        <h2 className={styles.title}>
                            {asset?.name ?? asset?.isin ?? "Unknown Asset"}
                        </h2>
                        <div className={styles.metaRow}>
                            <span>ISIN: {asset?.isin ?? "-"}</span>
                            <span>Symbol: {asset?.symbol ?? "-"}</span>
                            <span>
                                Source:{" "}
                                {String(asset?.externalMetadata?.metadataSource ?? "unknown")}
                            </span>
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

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Asset Snapshot</h3>

                    <div className={styles.kpiGrid}>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Net Shares</span>
                            <strong>{asset?.netShares ?? 0}</strong>
                        </div>

                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Remaining Cost Basis</span>
                            <strong>{formatCurrency(asset?.remainingCostBasis ?? 0)}</strong>
                        </div>

                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Position Value</span>
                            <strong>{formatCurrency(asset?.positionValue ?? 0)}</strong>
                        </div>

                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Dividends</span>
                            <strong>{formatCurrency(asset?.totalDividendNet ?? 0)}</strong>
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Reconciliation Warnings</h3>

                    {loading && <div className={styles.placeholder}>Lade Audit-Daten…</div>}
                    {error && <div className={styles.errorBox}>{error}</div>}

                    {!loading && !error && (data?.reconciliationWarnings?.length ?? 0) === 0 && (
                        <div className={styles.placeholder}>Keine Warnings für dieses Asset.</div>
                    )}

                    {!loading &&
                        !error &&
                        data?.reconciliationWarnings?.map((warning, index) => (
                            <div key={`${warning.isin}-${index}`} className={styles.warningCard}>
                                <div className={styles.warningSeverity}>
                                    {warning.severity.toUpperCase()}
                                </div>
                                <div>{warning.message}</div>
                            </div>
                        ))}
                </section>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Activities</h3>

                    <div className={styles.summaryRow}>
                        <span>Total: {data?.summary.total ?? 0}</span>
                        <span>Buy: {data?.summary.buyCount ?? 0}</span>
                        <span>Sell: {data?.summary.sellCount ?? 0}</span>
                        <span>Dividend: {data?.summary.dividendCount ?? 0}</span>
                        <span>Unknown: {data?.summary.unknownCount ?? 0}</span>
                    </div>

                    <div className={styles.activityList}>
                        {loading && <div className={styles.placeholder}>Lade Activities…</div>}

                        {!loading && !error && (data?.items.length ?? 0) === 0 && (
                            <div className={styles.placeholder}>
                                Keine Activities für dieses Asset gefunden.
                            </div>
                        )}

                        {!loading &&
                            !error &&
                            data?.items.map((item) => (
                                <article key={item.id} className={styles.activityCard}>
                                    <div className={styles.activityTopRow}>
                                        <strong>{item.type}</strong>
                                        <span>{item.datetime}</span>
                                    </div>

                                    <div className={styles.activityGrid}>
                                        <span>Portfolio: {item.portfolioName}</span>
                                        <span>Shares: {item.shares}</span>
                                        <span>Price: {formatCurrency(item.price)}</span>
                                        <span>Amount: {formatCurrency(item.amount)}</span>
                                        <span>Amount Net: {formatCurrency(item.amountNet)}</span>
                                        <span>Raw Type: {item.rawType}</span>
                                    </div>
                                </article>
                            ))}
                    </div>
                </section>
            </div>
        </aside>
    );
}