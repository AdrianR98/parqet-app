// src/components/dashboard/AssetTableRows.tsx

"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./AssetTable.module.css";
import type { AssetSummary } from "../../lib/types";
import { createAssetDetailHref } from "../../lib/asset-detail";
import { formatCurrency, formatDate, formatShares } from "../../lib/format";
import {
    getSafePortfolioBreakdown,
    type VisibleColumnKey,
} from "./asset-table-config";

type AssetTableRowsProps = {
    assets: AssetSummary[];
    visibleColumns: VisibleColumnKey[];
    expandedIsins: string[];
    onToggleExpandedAction: (isin: string) => void;
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

function getDisplayName(asset: AssetSummary): string {
    return (
        asset.name ??
        asset.assetName ??
        asset.displayName ??
        asset.title ??
        asset.symbol ??
        asset.ticker ??
        asset.tickerSymbol ??
        asset.wkn ??
        asset.isin
    );
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
                            {asset.ticker ? ` · ${asset.ticker}` : ""}
                            {asset.wkn ? ` · ${asset.wkn}` : ""}
                        </div>
                    </div>
                </div>
            );
        }

        case "positionValue":
            return formatCurrency(asset.positionValue);

        case "netShares":
            return formatShares(asset.netShares);

        case "avgBuyPrice":
            return formatCurrency(asset.avgBuyPrice);

        case "latestTradePrice":
            return formatCurrency(asset.latestTradePrice);

        case "unrealizedPnL":
            return formatCurrency(asset.unrealizedPnL);

        case "totalDividendNet":
            return formatCurrency(asset.totalDividendNet);

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
}: AssetTableRowsProps) {
    return (
        <table className={styles.table}>
            <tbody>
                {assets.map((asset) => {
                    const isExpanded = expandedIsins.includes(asset.isin);
                    const breakdown = getSafePortfolioBreakdown(asset);
                    const detailHref = createAssetDetailHref(asset);

                    return (
                        <Fragment key={asset.isin}>
                            <tr key={asset.isin}>
                                {visibleColumns.map((columnKey) => {
                                    if (columnKey === "actions") {
                                        return (
                                            <td
                                                key={`${asset.isin}-${columnKey}`}
                                                className={styles.actionCell}
                                            >
                                                {detailHref ? (
                                                    <Link
                                                        href={detailHref}
                                                        className="ui-btn ui-btn-ghost"
                                                        title="Assetdetail lokal öffnen"
                                                    >
                                                        Detail
                                                    </Link>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn-ghost"
                                                        disabled
                                                        title="Assetdetail benötigt einen stabilen Asset-Key"
                                                    >
                                                        Detail
                                                    </button>
                                                )}

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
                                                    <span>{formatShares(entry.netShares)}</span>
                                                    <span>{formatCurrency(entry.avgBuyPrice)}</span>
                                                    <span>{formatCurrency(entry.positionValue)}</span>
                                                    <span>{formatCurrency(entry.totalDividendNet)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ) : null}
                        </Fragment>
                    );
                })}
            </tbody>
        </table>
    );
}
