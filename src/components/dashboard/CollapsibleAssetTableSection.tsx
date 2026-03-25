// ============================================================
// src/components/dashboard/CollapsibleAssetTableSection.tsx
// ------------------------------------------------------------
// Schlanke, Parqet-nahe Wrapper-Sektion fuer Asset-Tabellen.
//
// Ziel:
// - kompakter klickbarer Header
// - kein schwerer Card-Block
// - minimaler Abstand zur Tabelle
// - Tabelle bleibt als eigenes Modul bestehen
// ============================================================

"use client";

import { useMemo, useState } from "react";
import type { AssetSummary } from "../../lib/types";
import AssetTable from "./AssetTable";
import styles from "./CollapsibleAssetTableSection.module.css";

type CollapsibleAssetTableSectionProps = {
    title: string;
    subtitle?: string;
    assets: AssetSummary[];
    defaultExpanded?: boolean;
    onAuditAssetAction?: (asset: AssetSummary) => void;
};

function sumPositionValue(assets: AssetSummary[]): number {
    return assets.reduce((sum, asset) => sum + (asset.positionValue ?? 0), 0);
}

function sumUnrealizedPnL(assets: AssetSummary[]): number {
    return assets.reduce((sum, asset) => sum + (asset.unrealizedPnL ?? 0), 0);
}

function formatCurrencyCompact(value: number): string {
    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
    }).format(value);
}

export default function CollapsibleAssetTableSection({
    title,
    subtitle,
    assets,
    defaultExpanded = true,
    onAuditAssetAction,
}: CollapsibleAssetTableSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const totalValue = useMemo(() => sumPositionValue(assets), [assets]);
    const totalPnL = useMemo(() => sumUnrealizedPnL(assets), [assets]);

    const pnlClassName =
        totalPnL > 0
            ? styles.positive
            : totalPnL < 0
                ? styles.negative
                : styles.neutral;

    return (
        <section className={styles.section}>
            <div
                className={styles.header}
                role="button"
                tabIndex={0}
                onClick={() => setIsExpanded((current) => !current)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setIsExpanded((current) => !current);
                    }
                }}
                aria-expanded={isExpanded}
            >
                <div className={styles.left}>
                    <span
                        className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""
                            }`}
                        aria-hidden="true"
                    >
                        ▾
                    </span>

                    <div className={styles.titleWrap}>
                        <h2 className={styles.title}>{title}</h2>
                        {subtitle ? (
                            <div className={styles.subtitle}>{subtitle}</div>
                        ) : null}
                    </div>
                </div>

                <div className={styles.right}>
                    <span className={styles.value}>
                        {formatCurrencyCompact(totalValue)}
                    </span>
                    <span className={`${styles.pnl} ${pnlClassName}`}>
                        {totalPnL > 0 ? "+" : totalPnL < 0 ? "−" : ""}
                        {formatCurrencyCompact(Math.abs(totalPnL))}
                    </span>
                </div>
            </div>

            {isExpanded ? (
                <div className={styles.content}>
                    <AssetTable
                        assets={assets}
                        hideHeader={true}
                        onAuditAsset={onAuditAssetAction}
                    />
                </div>
            ) : null}
        </section>
    );
}