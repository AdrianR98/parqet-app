"use client";

import { flexRender, getCoreRowModel, getSortedRowModel, type ColumnVisibilityState, type SortingState, useReactTable } from "@tanstack/react-table";
import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import styles from "./AssetTable.module.css";
import { getAssetTableColumns, renderExpandedRow, type AssetTableColumnKey } from "./asset-table-columns";
import type { AssetSummary } from "../../lib/types";
import { DEFAULT_REVEAL_BLOCK_SIZE, loadAssetTableVisibleColumns, loadRevealBlockSize, saveAssetTableVisibleColumns, subscribeToLocalSettings } from "../../lib/app-settings";

type AssetTableProps = { assets: AssetSummary[]; loading?: boolean; emptyTitle?: string; emptyDescription?: string };

const FIXED_COLUMNS: AssetTableColumnKey[] = ["name", "positionValue", "actions"];
const ALL_COLUMNS: AssetTableColumnKey[] = ["name", "remainingCostBasis", "positionValue", "unrealizedPnL", "totalDividendNet", "allocation", "actions"];
const DEFAULT_VISIBLE_COLUMNS: AssetTableColumnKey[] = ["name", "remainingCostBasis", "positionValue", "unrealizedPnL", "totalDividendNet", "allocation", "actions"];

function toVisibilityState(visibleColumns: AssetTableColumnKey[]): ColumnVisibilityState {
    const s = new Set(visibleColumns);
    const v: ColumnVisibilityState = {};
    for (const key of ALL_COLUMNS) v[key] = s.has(key);
    for (const key of FIXED_COLUMNS) v[key] = true;
    return v;
}

function getColumnPreferencesSnapshot(): string {
    return loadAssetTableVisibleColumns(ALL_COLUMNS, DEFAULT_VISIBLE_COLUMNS, FIXED_COLUMNS).join("|");
}

function getColumnWidth(columnId: AssetTableColumnKey): string {
    switch (columnId) {
        case "name":
            return "40%";
        case "remainingCostBasis":
            return "13%";
        case "positionValue":
            return "14%";
        case "unrealizedPnL":
            return "14%";
        case "totalDividendNet":
            return "11%";
        case "allocation":
            return "8%";
        case "actions":
            return "48px";
        default:
            return "auto";
    }
}

export default function AssetTable({ assets, loading = false, emptyTitle = "Keine Assets im geladenen Stand", emptyDescription = "Passe die Filter oben an oder lade Assets explizit neu, wenn du einen anderen Parqet-Stand erwartest." }: AssetTableProps) {
    const revealBlockSize = useSyncExternalStore(subscribeToLocalSettings, loadRevealBlockSize, () => DEFAULT_REVEAL_BLOCK_SIZE);
    const columnPreferencesSnapshot = useSyncExternalStore(subscribeToLocalSettings, getColumnPreferencesSnapshot, () => DEFAULT_VISIBLE_COLUMNS.join("|"));
    const [sorting, setSorting] = useState<SortingState>([{ id: "positionValue", desc: true }]);
    const [expandedIsins, setExpandedIsins] = useState<string[]>([]);
    const [visibleAssetCount, setVisibleAssetCount] = useState(DEFAULT_REVEAL_BLOCK_SIZE);
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() => toVisibilityState(loadAssetTableVisibleColumns(ALL_COLUMNS, DEFAULT_VISIBLE_COLUMNS, FIXED_COLUMNS) as AssetTableColumnKey[]));

    const visibleData = useMemo(() => assets.slice(0, visibleAssetCount), [assets, visibleAssetCount]);
    const totalPositionValue = useMemo(() => assets.reduce((sum, asset) => sum + (asset.positionValue ?? 0), 0), [assets]);
    const columns = useMemo(() => getAssetTableColumns(expandedIsins, setExpandedIsins, totalPositionValue), [expandedIsins, totalPositionValue]);

    const table = useReactTable({
        data: visibleData,
        columns,
        state: { sorting, columnVisibility },
        onSortingChange: setSorting,
        onColumnVisibilityChange: (updater) => setColumnVisibility((current) => {
            const next = typeof updater === "function" ? updater(current) : updater;
            const forced = { ...next };
            for (const key of FIXED_COLUMNS) forced[key] = true;
            saveAssetTableVisibleColumns(ALL_COLUMNS.filter((key) => forced[key] !== false));
            return forced;
        }),
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const visibleColumns = table.getVisibleLeafColumns();
    const visibleColumnIds = visibleColumns.map((column) => column.id as AssetTableColumnKey);
    const sortedAssets = table.getSortedRowModel().rows;
    const hasRows = sortedAssets.length > 0;

    useEffect(() => setVisibleAssetCount(revealBlockSize), [revealBlockSize]);
    useEffect(() => {
        const nextVisible = loadAssetTableVisibleColumns(ALL_COLUMNS, DEFAULT_VISIBLE_COLUMNS, FIXED_COLUMNS) as AssetTableColumnKey[];
        setColumnVisibility(toVisibilityState(nextVisible));
    }, [columnPreferencesSnapshot]);

    if (loading && !hasRows) return <div className={styles.stateBox}><p>AssetTrace lädt den explizit angeforderten Parqet-Stand.</p></div>;
    if (!hasRows) return <div className={styles.stateBox}><strong>{emptyTitle}</strong><p>{emptyDescription}</p></div>;

    return (
        <div className={styles.container} aria-busy={loading}>
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <colgroup>
                        {visibleColumnIds.map((columnId) => (
                            <col key={columnId} style={{ width: getColumnWidth(columnId) }} />
                        ))}
                    </colgroup>
                    <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => header.column.getIsVisible() ? (
                                    <th key={header.id}>
                                        {header.column.getCanSort() ? (
                                            <button type="button" className={styles.sortButton} onClick={header.column.getToggleSortingHandler()}>
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                            </button>
                                        ) : flexRender(header.column.columnDef.header, header.getContext())}
                                    </th>
                                ) : null)}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {sortedAssets.map((row) => {
                            const isExpanded = expandedIsins.includes(row.original.isin);
                            return (
                                <Fragment key={row.id}>
                                    <tr className={styles.assetRow}>
                                        {row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                                    </tr>
                                    {isExpanded ? renderExpandedRow(row.original, visibleColumnIds) : null}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
