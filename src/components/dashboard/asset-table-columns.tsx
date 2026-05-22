"use client";

import { Fragment, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import styles from "./AssetTable.module.css";
import type { AssetSummary } from "../../lib/types";
import { createAssetDetailHref } from "../../lib/asset-detail";
import { formatCurrency, formatShares } from "../../lib/format";
import { getSafePortfolioBreakdown } from "./asset-table-config";
import { getAssetDisplayName, getAssetSubtitle, getAssetInitials, getAssetLogoUrl as getIsinLogoUrl } from "../../lib/asset-display";

export type AssetTableColumnKey = "name" | "remainingCostBasis" | "positionValue" | "unrealizedPnL" | "totalDividendNet" | "allocation" | "actions";

const columnHelper = createColumnHelper<AssetSummary>();

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

    return getIsinLogoUrl(asset);
}

function buildMetaLine(asset: AssetSummary, subtitle: string): string {
    const parts: string[] = [];
    const normalizedMain = subtitle.trim().toUpperCase();
    const normalizedIsin = asset.isin.trim().toUpperCase();

    if (subtitle.trim().length > 0 && normalizedMain !== normalizedIsin) {
        parts.push(subtitle);
    }

    if (asset.isin.trim().length > 0 && !parts.some((entry) => entry.trim().toUpperCase() === normalizedIsin)) {
        parts.push(asset.isin);
    }

    return parts.join(" · ");
}

function AssetLogo({ asset, displayName }: { asset: AssetSummary; displayName: string }) {
    const [imageFailed, setImageFailed] = useState(false);
    const logoUrl = getLogoUrl(asset);

    if (!logoUrl || imageFailed) {
        return <span className={styles.assetLogoFallback}>{getAssetInitials(asset)}</span>;
    }

    return (
        <img
            src={logoUrl}
            alt={`${displayName} Logo`}
            width={30}
            height={30}
            className={styles.assetLogoImage}
            onError={() => setImageFailed(true)}
            loading="lazy"
            decoding="async"
        />
    );
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
                const displayName = getAssetDisplayName(asset);
                const subtitle = getAssetSubtitle(asset);
                const metaLine = buildMetaLine(asset, subtitle);

                return (
                    <div className={styles.assetIdentity}>
                        <div className={styles.assetLogo}>
                            <AssetLogo asset={asset} displayName={displayName} />
                        </div>
                        <div className={styles.assetIdentityText}>
                            {detailHref ? <Link href={detailHref} className={styles.assetNameLink} title={displayName}>{displayName}</Link> : <div className={styles.assetName} title={displayName}>{displayName}</div>}
                            {metaLine ? <div className={styles.assetMeta}>{metaLine}</div> : null}
                        </div>
                    </div>
                );
            },
        }),
        columnHelper.accessor("remainingCostBasis", { id: "remainingCostBasis", header: "Einstand", cell: ({ getValue }) => formatCurrency(getValue()) }),
        columnHelper.accessor("positionValue", { id: "positionValue", header: "Positionswert", cell: ({ getValue }) => formatCurrency(getValue()) }),
        columnHelper.accessor("unrealizedPnL", {
            id: "unrealizedPnL",
            header: "Gewinn / Verlust",
            cell: ({ getValue }) => {
                const value = getValue() ?? 0;
                return <span className={value >= 0 ? styles.positive : styles.negative}>{formatCurrency(value)}</span>;
            },
        }),
        columnHelper.accessor("totalDividendNet", { id: "totalDividendNet", header: "Dividenden", cell: ({ getValue }) => formatCurrency(getValue()) }),
        columnHelper.display({
            id: "allocation",
            header: "Allokation",
            cell: ({ row }) => {
                const value = row.original.positionValue ?? 0;
                const ratio = totalPositionValue > 0 ? (value / totalPositionValue) * 100 : 0;
                return <span className={styles.allocationCell}>{ratio.toFixed(1)} %</span>;
            },
        }),
        columnHelper.display({
            id: "actions",
            header: "",
            enableHiding: false,
            cell: ({ row }) => {
                const asset = row.original;
                const isExpanded = expandedSet.has(asset.isin);
                return (
                    <button
                        type="button"
                        className={styles.chevronButton}
                        onClick={() => setExpandedIsins((current) => current.includes(asset.isin) ? current.filter((entry) => entry !== asset.isin) : [...current, asset.isin])}
                        aria-label="Portfolio-Breakdown umschalten"
                    >
                        {isExpanded ? "⌄" : "›"}
                    </button>
                );
            },
        }),
    ];
}

function renderBreakdownCell(columnId: AssetTableColumnKey, asset: AssetSummary, entry: ReturnType<typeof getSafePortfolioBreakdown>[number]) {
    switch (columnId) {
        case "name":
            return <span className={styles.breakdownName}>↳ {entry.portfolioName}</span>;
        case "remainingCostBasis":
            return formatCurrency(entry.remainingCostBasis);
        case "positionValue":
            return formatCurrency(entry.positionValue);
        case "unrealizedPnL":
            return formatCurrency(entry.unrealizedPnL);
        case "totalDividendNet":
            return formatCurrency(entry.totalDividendNet);
        case "allocation": {
            const assetPosition = asset.positionValue ?? 0;
            const rowPosition = entry.positionValue ?? 0;
            const ratio = assetPosition > 0 ? (rowPosition / assetPosition) * 100 : 0;
            return `${ratio.toFixed(1)} %`;
        }
        case "actions":
            return "";
        default:
            return "";
    }
}

export function renderExpandedRow(asset: AssetSummary, visibleColumnIds: AssetTableColumnKey[]) {
    const breakdown = getSafePortfolioBreakdown(asset);

    return (
        <Fragment key={`${asset.isin}-expanded`}>
            {breakdown.map((entry) => (
                <tr key={`${asset.isin}-${entry.portfolioId}`} className={styles.breakdownAlignedRow}>
                    {visibleColumnIds.map((columnId) => (
                        <td key={`${entry.portfolioId}-${columnId}`}>{renderBreakdownCell(columnId, asset, entry)}</td>
                    ))}
                </tr>
            ))}
        </Fragment>
    );
}
