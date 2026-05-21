"use client";

import type { Dispatch, SetStateAction } from "react";
import Image from "next/image";
import Link from "next/link";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import styles from "./AssetTable.module.css";
import type { AssetSummary } from "../../lib/types";
import { createAssetDetailHref } from "../../lib/asset-detail";
import { formatCurrency, formatDate, formatShares } from "../../lib/format";
import { getSafePortfolioBreakdown } from "./asset-table-config";

export type AssetTableColumnKey =
    | "name"
    | "positionValue"
    | "netShares"
    | "avgBuyPrice"
    | "latestTradePrice"
    | "unrealizedPnL"
    | "totalDividendNet"
    | "latestActivityAt"
    | "actions";

const columnHelper = createColumnHelper<AssetSummary>();

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

export function getAssetTableColumns(
    expandedIsins: string[],
    setExpandedIsins: Dispatch<SetStateAction<string[]>>
): ColumnDef<AssetSummary, unknown>[] {
    const expandedSet = new Set(expandedIsins);

    return [
        columnHelper.accessor("name", {
            id: "name",
            header: "Name",
            enableHiding: false,
            sortingFn: "alphanumeric",
            cell: ({ row }) => {
                const asset = row.original;
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
                                <span className={styles.assetLogoFallback}>{getInitials(asset)}</span>
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
            },
        }),
        columnHelper.accessor("positionValue", {
            id: "positionValue",
            header: "Positionswert",
            enableHiding: false,
            cell: ({ getValue }) => formatCurrency(getValue()),
        }),
        columnHelper.accessor("netShares", {
            id: "netShares",
            header: "Bestand",
            cell: ({ getValue }) => formatShares(getValue()),
        }),
        columnHelper.accessor("avgBuyPrice", {
            id: "avgBuyPrice",
            header: "Ø Kaufpreis",
            cell: ({ getValue }) => formatCurrency(getValue()),
        }),
        columnHelper.accessor("latestTradePrice", {
            id: "latestTradePrice",
            header: "Letzter Preis",
            cell: ({ getValue }) => formatCurrency(getValue()),
        }),
        columnHelper.accessor("unrealizedPnL", {
            id: "unrealizedPnL",
            header: "Unrealisiert",
            cell: ({ getValue }) => formatCurrency(getValue()),
        }),
        columnHelper.accessor("totalDividendNet", {
            id: "totalDividendNet",
            header: "Dividenden",
            cell: ({ getValue }) => formatCurrency(getValue()),
        }),
        columnHelper.accessor("latestActivityAt", {
            id: "latestActivityAt",
            header: "Letzte Aktivität",
            cell: ({ getValue }) => formatDate(getValue()),
        }),
        columnHelper.display({
            id: "actions",
            header: "Aktionen",
            cell: ({ row }) => {
                const asset = row.original;
                const detailHref = createAssetDetailHref(asset);
                const isExpanded = expandedSet.has(asset.isin);

                return (
                    <div className={styles.actionCell}>
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
                                setExpandedIsins((current) =>
                                    current.includes(asset.isin)
                                        ? current.filter((entry) => entry !== asset.isin)
                                        : [...current, asset.isin]
                                )
                            }
                        >
                            {isExpanded ? "▾" : "▸"}
                        </button>
                    </div>
                );
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
                    <div className={styles.breakdownHeader}>
                        <span>Portfolio</span>
                        <span>Bestand</span>
                        <span>Ø Kaufpreis</span>
                        <span>Positionswert</span>
                        <span>Dividenden</span>
                    </div>
                    {breakdown.map((entry) => (
                        <div key={`${asset.isin}-${entry.portfolioId}`} className={styles.breakdownRow}>
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
    );
}
