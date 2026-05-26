"use client";

import { Fragment, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import styles from "./AssetTable.module.css";
import type { GlobalAssetViewModel } from "../../lib/types";
import { createAssetDetailHref } from "../../lib/asset-detail";
import { formatCurrency } from "../../lib/format";
import { getSafePortfolioBreakdown } from "./asset-table-config";
import { buildInstrumentSubtitleParts, getAssetDisplayName } from "../../lib/asset-display";
import AssetLogo from "../common/AssetLogo";

export type AssetTableColumnKey = "name" | "remainingCostBasis" | "positionValue" | "unrealizedPnL" | "totalDividendNet" | "allocation" | "actions";

const columnHelper = createColumnHelper<GlobalAssetViewModel>();

async function copyTextToClipboard(value: string): Promise<boolean> {
    if (!value.trim()) {
        return false;
    }

    try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return true;
        }

        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.setAttribute("readonly", "true");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        return copied;
    } catch {
        return false;
    }
}

function CopyableIdentifier({
    label,
    value,
}: {
    label: "ISIN" | "WKN";
    value: string;
}) {
    const [copied, setCopied] = useState(false);

    return (
        <span className={styles.identifierPart}>
            <span>{label} </span>
            <button
                type="button"
                className={`${styles.inlineCopyButton} ${copied ? styles.inlineCopyButtonCopied : ""}`}
                title={`${label} kopieren`}
                aria-label={`${label} ${value} kopieren`}
                onClick={async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const ok = await copyTextToClipboard(value);
                    if (!ok) {
                        return;
                    }
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1100);
                }}
            >
                {value}
            </button>
        </span>
    );
}

function AssetMetaLine({ asset }: { asset: GlobalAssetViewModel }) {
    const subtitleParts = buildInstrumentSubtitleParts(asset);

    if (subtitleParts.length === 0) {
        return null;
    }

    return (
        <div className={styles.assetMeta}>
            {subtitleParts.map((part, index) => {
                const isIsin = part.startsWith("ISIN ");
                const isWkn = part.startsWith("WKN ");
                const value = part.split(" ").slice(1).join(" ").trim();
                const key = `${asset.isin}-${part}-${index}`;

                return (
                    <Fragment key={key}>
                        {index > 0 ? <span className={styles.metaSeparator}>·</span> : null}
                        {isIsin && value ? <CopyableIdentifier label="ISIN" value={value} /> : null}
                        {isWkn && value ? <CopyableIdentifier label="WKN" value={value} /> : null}
                        {!isIsin && !isWkn ? <span className={styles.identifierPart}>{part}</span> : null}
                    </Fragment>
                );
            })}
        </div>
    );
}

export function getAssetTableColumns(expandedIsins: string[], setExpandedIsins: Dispatch<SetStateAction<string[]>>, totalPositionValue: number) {
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

                return (
                    <div className={styles.assetIdentity}>
                        <div className={styles.assetLogo}>
                            <AssetLogo
                                asset={asset}
                                displayName={displayName}
                                imageClassName={styles.assetLogoImage}
                                fallbackClassName={styles.assetLogoFallback}
                                loading="lazy"
                            />
                        </div>
                        <div className={styles.assetIdentityText}>
                            {detailHref ? <Link href={detailHref} prefetch={false} className={styles.assetNameLink} title={displayName}>{displayName}</Link> : <div className={styles.assetName} title={displayName}>{displayName}</div>}
                            <AssetMetaLine asset={asset} />
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

function renderBreakdownCell(columnId: AssetTableColumnKey, asset: GlobalAssetViewModel, entry: ReturnType<typeof getSafePortfolioBreakdown>[number]) {
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

export function renderExpandedRow(asset: GlobalAssetViewModel, visibleColumnIds: AssetTableColumnKey[]) {
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

