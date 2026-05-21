"use client";

import type { Dispatch, SetStateAction } from "react";
import Image from "next/image";
import Link from "next/link";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import styles from "./AssetTable.module.css";
import type { AssetSummary } from "../../lib/types";
import { createAssetDetailHref } from "../../lib/asset-detail";
import { formatCurrency, formatShares } from "../../lib/format";
import { getSafePortfolioBreakdown } from "./asset-table-config";

export type AssetTableColumnKey = "name" | "remainingCostBasis" | "positionValue" | "unrealizedPnL" | "totalDividendNet" | "allocation" | "actions";

const columnHelper = createColumnHelper<AssetSummary>();

function getDisplayName(asset: AssetSummary): string {
    return asset.name ?? asset.assetName ?? asset.displayName ?? asset.title ?? asset.symbol ?? asset.ticker ?? asset.tickerSymbol ?? asset.wkn ?? asset.isin;
}

function getLogoUrl(asset: AssetSummary): string | null {
    const candidates = [asset.metadata as Record<string, unknown> | undefined, asset.externalMetadata as Record<string, unknown> | undefined, asset.assetMeta as Record<string, unknown> | undefined];
    for (const candidate of candidates) {
        const value = candidate?.logoUrl;
        if (typeof value === "string" && value.trim().length > 0) return value;
    }
    return null;
}

export function getAssetTableColumns(expandedIsins: string[], setExpandedIsins: Dispatch<SetStateAction<string[]>>, totalPositionValue: number): ColumnDef<AssetSummary, unknown>[] {
    const expandedSet = new Set(expandedIsins);

    return [
        columnHelper.accessor("name", {
            id: "name",
            header: "Name",
            enableHiding: false,
            sortingFn: "alphanumeric",
            cell: ({ row }) => {
                const asset = row.original;
                const detailHref = createAssetDetailHref(asset);
                const logoUrl = getLogoUrl(asset);
                const displayName = getDisplayName(asset);

                return (
                    <div className={styles.assetIdentity}>
                        <div className={styles.assetLogo}>{logoUrl ? <Image src={logoUrl} alt={displayName} width={28} height={28} className={styles.assetLogoImage} /> : <span className={styles.assetLogoFallback}>{displayName.slice(0, 2).toUpperCase()}</span>}</div>
                        <div className={styles.assetIdentityText}>
                            {detailHref ? <Link href={detailHref} className={styles.assetNameLink}>{displayName}</Link> : <div className={styles.assetName}>{displayName}</div>}
                            <div className={styles.assetMeta}>{asset.isin}{asset.symbol ? ` · ${asset.symbol}` : ""}</div>
                        </div>
                    </div>
                );
            },
        }),
        columnHelper.accessor("remainingCostBasis", { id: "remainingCostBasis", header: "Einstand", cell: ({ getValue }) => formatCurrency(getValue()) }),
        columnHelper.accessor("positionValue", { id: "positionValue", header: "Positionswert", cell: ({ getValue }) => formatCurrency(getValue()) }),
        columnHelper.accessor("unrealizedPnL", { id: "unrealizedPnL", header: "Gewinn / Verlust", cell: ({ getValue }) => formatCurrency(getValue()) }),
        columnHelper.accessor("totalDividendNet", { id: "totalDividendNet", header: "Dividenden", cell: ({ getValue }) => formatCurrency(getValue()) }),
        columnHelper.display({
            id: "allocation",
            header: "Allokation",
            cell: ({ row }) => {
                const value = row.original.positionValue ?? 0;
                const ratio = totalPositionValue > 0 ? (value / totalPositionValue) * 100 : 0;
                return `${ratio.toFixed(1)} %`;
            },
        }),
        columnHelper.display({
            id: "actions",
            header: "",
            enableHiding: false,
            cell: ({ row }) => {
                const asset = row.original;
                const isExpanded = expandedSet.has(asset.isin);
                return <button type="button" className="ui-icon-btn" onClick={() => setExpandedIsins((current) => current.includes(asset.isin) ? current.filter((entry) => entry !== asset.isin) : [...current, asset.isin])} aria-label="Portfolio-Breakdown umschalten">{isExpanded ? "⌄" : "›"}</button>;
            },
        }),
    ];
}

export function renderExpandedRow(asset: AssetSummary, colspan: number) {
    const breakdown = getSafePortfolioBreakdown(asset);

    return (
        <tr className={styles.expandedRow} key={`${asset.isin}-expanded`}>
            <td colSpan={colspan}>
                <div className={styles.breakdownCard}>
                    {breakdown.map((entry) => (
                        <div key={`${asset.isin}-${entry.portfolioId}`} className={styles.breakdownRow}>
                            <span>{entry.portfolioName}</span>
                            <span>{formatShares(entry.netShares)}</span>
                            <span>{formatCurrency(entry.positionValue)}</span>
                            <span>{formatCurrency(entry.totalDividendNet)}</span>
                        </div>
                    ))}
                </div>
            </td>
        </tr>
    );
}
