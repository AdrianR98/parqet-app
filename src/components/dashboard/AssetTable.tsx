"use client";

import { flexRender, getCoreRowModel, getSortedRowModel, type ColumnVisibilityState, type SortingState, useReactTable } from "@tanstack/react-table";
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import styles from "./AssetTable.module.css";
import { getAssetTableColumns, renderExpandedRow, type AssetTableColumnKey } from "./asset-table-columns";
import type { AssetSummary } from "../../lib/types";
import { DEFAULT_REVEAL_BLOCK_SIZE, loadAssetTableVisibleColumns, loadRevealBlockSize, saveAssetTableVisibleColumns, subscribeToLocalSettings } from "../../lib/app-settings";

type AssetTableProps = { assets: AssetSummary[]; loading?: boolean; emptyTitle?: string; emptyDescription?: string };

const FIXED_COLUMNS: AssetTableColumnKey[] = ["name", "positionValue", "actions"];
const ALL_COLUMNS: AssetTableColumnKey[] = ["name", "remainingCostBasis", "positionValue", "unrealizedPnL", "totalDividendNet", "allocation", "actions"];
const DEFAULT_VISIBLE_COLUMNS: AssetTableColumnKey[] = ["name", "remainingCostBasis", "positionValue", "unrealizedPnL", "totalDividendNet", "allocation", "actions"];
const TOGGLABLE_COLUMNS: AssetTableColumnKey[] = ALL_COLUMNS.filter((key) => !FIXED_COLUMNS.includes(key));

function getSearchText(asset: AssetSummary): string { return [asset.name, asset.assetName, asset.displayName, asset.title, asset.symbol, asset.ticker, asset.tickerSymbol, asset.wkn, asset.isin].filter((value): value is string => typeof value === "string").join(" ").toLowerCase(); }
function toVisibilityState(visibleColumns: AssetTableColumnKey[]): ColumnVisibilityState { const s = new Set(visibleColumns); const v: ColumnVisibilityState = {}; for (const key of ALL_COLUMNS) v[key] = s.has(key); for (const key of FIXED_COLUMNS) v[key] = true; return v; }

export default function AssetTable({ assets, loading = false, emptyTitle = "Keine Assets im geladenen Stand", emptyDescription = "Passe die lokale Suche an oder lade Assets explizit neu, wenn du einen anderen Parqet-Stand erwartest." }: AssetTableProps) {
    const revealBlockSize = useSyncExternalStore(subscribeToLocalSettings, loadRevealBlockSize, () => DEFAULT_REVEAL_BLOCK_SIZE);
    const [sorting, setSorting] = useState<SortingState>([{ id: "positionValue", desc: true }]);
    const [expandedIsins, setExpandedIsins] = useState<string[]>([]);
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [query, setQuery] = useState("");
    const [visibleAssetCount, setVisibleAssetCount] = useState(DEFAULT_REVEAL_BLOCK_SIZE);
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() => toVisibilityState(loadAssetTableVisibleColumns(ALL_COLUMNS, DEFAULT_VISIBLE_COLUMNS, FIXED_COLUMNS) as AssetTableColumnKey[]));
    const columnMenuRef = useRef<HTMLDivElement | null>(null);

    const filteredAssets = useMemo(() => { const q = query.trim().toLowerCase(); return q ? assets.filter((asset) => getSearchText(asset).includes(q)) : assets; }, [assets, query]);
    const visibleData = useMemo(() => filteredAssets.slice(0, visibleAssetCount), [filteredAssets, visibleAssetCount]);
    const totalPositionValue = useMemo(() => visibleData.reduce((sum, asset) => sum + (asset.positionValue ?? 0), 0), [visibleData]);
    const columns = useMemo(() => getAssetTableColumns(expandedIsins, setExpandedIsins, totalPositionValue), [expandedIsins, totalPositionValue]);

    const table = useReactTable({ data: visibleData, columns, state: { sorting, columnVisibility }, onSortingChange: setSorting, onColumnVisibilityChange: (updater) => setColumnVisibility((current) => { const next = typeof updater === "function" ? updater(current) : updater; const forced = { ...next }; for (const key of FIXED_COLUMNS) forced[key] = true; saveAssetTableVisibleColumns(ALL_COLUMNS.filter((key) => forced[key] !== false)); return forced; }), getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

    const visibleColumns = table.getVisibleLeafColumns();
    const sortedAssets = table.getSortedRowModel().rows;
    const hasRows = sortedAssets.length > 0;

    useEffect(() => setVisibleAssetCount(revealBlockSize), [revealBlockSize]);
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) { const target = event.target as Node; if (!columnMenuRef.current?.contains(target)) setShowColumnMenu(false); }
        if (showColumnMenu) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showColumnMenu]);

    if (loading && !hasRows) return <div className={styles.stateBox}><p>AssetTrace lädt den explizit angeforderten Parqet-Stand.</p></div>;
    if (!hasRows) return <div className={styles.stateBox}><strong>{emptyTitle}</strong><p>{emptyDescription}</p></div>;

    return (
        <div className={styles.container} aria-busy={loading}>
            <div className={styles.toolbar}>
                <input className={`ui-input ${styles.searchInput}`} type="search" value={query} onChange={(event) => { setVisibleAssetCount(revealBlockSize); setQuery(event.target.value); }} placeholder="Lokal suchen: Name, ISIN, WKN" aria-label="Assets lokal suchen" disabled={loading} />
                <div ref={columnMenuRef} className={styles.columnMenuWrap}>
                    <button type="button" className="ui-icon-btn" aria-haspopup="menu" aria-expanded={showColumnMenu} aria-label="Spalteneinstellungen" onClick={() => setShowColumnMenu((current) => !current)} disabled={loading || !hasRows}>⚙</button>
                    {showColumnMenu ? <div className={styles.columnMenu} role="menu" aria-label="Sichtbare Spalten">{table.getAllLeafColumns().filter((column) => TOGGLABLE_COLUMNS.includes(column.id as AssetTableColumnKey)).map((column) => (<label key={column.id} className={styles.columnMenuItem}><input type="checkbox" checked={column.getIsVisible()} onChange={column.getToggleVisibilityHandler()} /><span>{String(column.columnDef.header)}</span></label>))}</div> : null}
                </div>
            </div>
            <div className={styles.tableWrap}>
                <table className={styles.table}>
                    <thead>{table.getHeaderGroups().map((headerGroup) => (<tr key={headerGroup.id}>{headerGroup.headers.map((header) => header.column.getIsVisible() ? <th key={header.id}>{header.column.getCanSort() ? <button type="button" className="ui-btn ui-btn-ghost" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}</button> : flexRender(header.column.columnDef.header, header.getContext())}</th> : null)}</tr>))}</thead>
                    <tbody>{sortedAssets.map((row) => { const isExpanded = expandedIsins.includes(row.original.isin); return <Fragment key={row.id}><tr>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>{isExpanded ? renderExpandedRow(row.original, visibleColumns.length) : null}</Fragment>; })}</tbody>
                </table>
            </div>
        </div>
    );
}
