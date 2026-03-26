// src/components/dashboard/AssetTableRows.tsx

"use client";

import Image from "next/image";
import styles from "./AssetTable.module.css";
import type { AssetSummary } from "../../lib/types";
import { formatCurrency } from "../../lib/format";
import {
    getSafePortfolioBreakdown,
    type VisibleColumnKey,
} from "./asset-table-config";

type AssetTableRowsProps = {
    assets: AssetSummary[];
    visibleColumns: VisibleColumnKey[];
    expandedIsins: string[];
    onToggleExpandedAction: (isin: string) => void;
    onAuditAssetAction?: (asset: AssetSummary) => void | Promise<void>;
};

/**
 * ============================================================
 * COMPONENT: ASSET TABLE ROWS
 * ============================================================
 *
 * Wichtig:
 * - Callback-Props enden bewusst auf "Action"
 * - Asset-Icon-Logik ist hier zentralisiert
 *
 * Typische Erweiterungspunkte:
 * - echte Logoquelle aus Metadata
 * - Thumbnail-Fallbacks
 * - Status-Badges
 */

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
    }).format(date);
}

function getDisplayName(asset: AssetSummary): string {
    return asset.name ?? asset.assetName ?? asset.displayName ?? asset.title ?? asset.isin;
}

function getLogoUrl(asset: AssetSummary): string | null {
    const candidates = [
        asset.metadata as Record<string, unknown> | undefined,
        asset.externalMetadata as Record<string, unknown> | undefined,
        asset.assetMeta as Record<string, unknown> | undefined,
    ];

    for (const candidate of candidates) {
        const value = candidate?.logoUrl;
        if (typeof value === "string" && value.trim().length > 0) {
            return value;
        }
    }

    return null;
}

function getInitials(asset: AssetSummary): string {
    const label = getDisplayName(asset).trim();

    if (!label) {
        return asset.isin.slice(0, 2).toUpperCase();
    }

    const words = label.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
        return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
    }

    return label.slice(0, 2).toUpperCase();
}

function renderCell(asset: AssetSummary, columnKey: VisibleColumnKey) {
    switch (columnKey) {
        case "name": {
            const logoUrl = getLogoUrl(asset);
            const displayName = getDisplayName(asset);

            return (
                <div className={styles.assetIdentity}>
                    <div className={styles.assetLogo}>
                        {logoUrl ? (
                            <Image
                                src={logoUrl}
                                alt={displayName}
                                width={28}
                                height={28}
                                className={styles.assetLogoImage}
                            />
                        ) : (
                            <span className={styles.assetLogoFallback}>
                                {getInitials(asset)}
                            </span>
                        )}
                    </div>

                    <div className={styles.assetIdentityText}>
                        <div className={styles.assetName}>{displayName}</div>
                        <div className={styles.assetMeta}>
                            {asset.isin}
                            {asset.symbol ? ` · ${asset.symbol}` : ""}
                            {asset.wkn ? ` · ${asset.wkn}` : ""}
                        </div>
                    </div>
                </div>
            );
        }

        case "positionValue":
            return formatCurrency(asset.positionValue ?? 0);

        case "netShares":
            return asset.netShares ?? 0;

        case "avgBuyPrice":
            return formatCurrency(asset.avgBuyPrice ?? 0);

        case "latestTradePrice":
            return formatCurrency(asset.latestTradePrice ?? 0);

        case "unrealizedPnL":
            return formatCurrency(asset.unrealizedPnL ?? 0);

        case "totalDividendNet":
            return formatCurrency(asset.totalDividendNet ?? 0);

        case "latestActivityAt":
            return formatDate(asset.latestActivityAt);

        case "actions":
            return null;

        default:
            return "—";
    }
}

export default function AssetTableRows({
    assets,
    visibleColumns,
    expandedIsins,
    onToggleExpandedAction,
    onAuditAssetAction,
}: AssetTableRowsProps) {
    return (
        <table className={styles.table}>
            <tbody>
                {assets.map((asset) => {
                    const isExpanded = expandedIsins.includes(asset.isin);
                    const breakdown = getSafePortfolioBreakdown(asset);

                    return (
                        <>
                            <tr key={asset.isin}>
                                {visibleColumns.map((columnKey) => {
                                    if (columnKey === "actions") {
                                        return (
                                            <td
                                                key={`${asset.isin}-${columnKey}`}
                                                className={styles.actionCell}
                                            >
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn-ghost"
                                                    onClick={() => onAuditAssetAction?.(asset)}
                                                >
                                                    Bearbeiten
                                                </button>

                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn-ghost"
                                                    onClick={() =>
                                                        onToggleExpandedAction(asset.isin)
                                                    }
                                                >
                                                    {isExpanded ? "▾" : "▸"}
                                                </button>
                                            </td>
                                        );
                                    }

                                    return (
                                        <td key={`${asset.isin}-${columnKey}`}>
                                            {renderCell(asset, columnKey)}
                                        </td>
                                    );
                                })}
                            </tr>

                            {isExpanded ? (
                                <tr key={`${asset.isin}-expanded`} className={styles.expandedRow}>
                                    <td colSpan={visibleColumns.length}>
                                        <div className={styles.breakdownCard}>
                                            <div className={styles.breakdownHeader}>
                                                <span>Portfolio</span>
                                                <span>Bestand</span>
                                                <span>Ø Kaufpreis</span>
                                                <span>Positionswert</span>
                                                <span>Dividenden</span>
                                            </div>

                                            {breakdown.map((entry) => (
                                                <div
                                                    key={`${asset.isin}-${entry.portfolioId}`}
                                                    className={styles.breakdownRow}
                                                >
                                                    <span>{entry.portfolioName}</span>
                                                    <span>{entry.netShares}</span>
                                                    <span>{formatCurrency(entry.avgBuyPrice ?? 0)}</span>
                                                    <span>{formatCurrency(entry.positionValue ?? 0)}</span>
                                                    <span>{formatCurrency(entry.totalDividendNet ?? 0)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ) : null}
                        </>
                    );
                })}
            </tbody>
        </table>
    );
}