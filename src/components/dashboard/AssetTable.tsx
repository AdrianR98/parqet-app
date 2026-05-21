"use client";

import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    type ColumnVisibilityState,
    type SortingState,
    useReactTable,
} from "@tanstack/react-table";
import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import styles from "./AssetTable.module.css";
import SyncedHorizontalScroll from "./SyncedHorizontalScroll";
import { getAssetTableColumns, renderExpandedRow, type AssetTableColumnKey } from "./asset-table-columns";
import type { AssetSummary } from "../../lib/types";
import {
    DEFAULT_REVEAL_BLOCK_SIZE,
    loadAssetTableVisibleColumns,
    loadRevealBlockSize,
    saveAssetTableVisibleColumns,
    subscribeToLocalSettings,
} from "../../lib/app-settings";
import { getColumnMinWidth } from "./asset-table-config";

type AssetTableProps = {
    assets: AssetSummary[];
    loading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
};

const FIXED_COLUMNS: AssetTableColumnKey[] = ["name", "positionValue"];
const ALL_COLUMNS: AssetTableColumnKey[] = [
    "name",
    "positionValue",
    "netShares",
    "avgBuyPrice",
    "latestTradePrice",
    "unrealizedPnL",
    "totalDividendNet",
    "latestActivityAt",
    "actions",
];
const DEFAULT_VISIBLE_COLUMNS: AssetTableColumnKey[] = [...ALL_COLUMNS];
const TOGGLABLE_COLUMNS: AssetTableColumnKey[] = ALL_COLUMNS.filter((key) => !FIXED_COLUMNS.includes(key));

function getSearchText(asset: AssetSummary): string {
    return [
        asset.name,
        asset.assetName,
        asset.displayName,
        asset.title,
        asset.symbol,
        asset.ticker,
        asset.tickerSymbol,
        asset.wkn,
        asset.isin,
    ]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLowerCase();
}

function toVisibilityState(visibleColumns: AssetTableColumnKey[]): ColumnVisibilityState {
    const selected = new Set(visibleColumns);
    const visibility: ColumnVisibilityState = {};

    for (const key of ALL_COLUMNS) {
        visibility[key] = selected.has(key);
    }

    for (const key of FIXED_COLUMNS) {
        visibility[key] = true;
    }

    return visibility;
}

export default function AssetTable({
    assets,
    loading = false,
    emptyTitle = "Keine Assets im geladenen Stand",
    emptyDescription = "Passe die lokale Suche an oder lade Assets explizit neu, wenn du einen anderen Parqet-Stand erwartest.",
}: AssetTableProps) {
    const revealBlockSize = useSyncExternalStore(
        subscribeToLocalSettings,
        loadRevealBlockSize,
        () => DEFAULT_REVEAL_BLOCK_SIZE
    );
    const [sorting, setSorting] = useState<SortingState>([{ id: "positionValue", desc: true }]);
    const [expandedIsins, setExpandedIsins] = useState<string[]>([]);
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [showTopScrollbar, setShowTopScrollbar] = useState(false);
    const [query, setQuery] = useState("");
    const [visibleAssetCount, setVisibleAssetCount] = useState(DEFAULT_REVEAL_BLOCK_SIZE);
    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
        toVisibilityState(
            loadAssetTableVisibleColumns(ALL_COLUMNS, DEFAULT_VISIBLE_COLUMNS, FIXED_COLUMNS) as AssetTableColumnKey[]
        )
    );

    const tableScrollRef = useRef<HTMLDivElement | null>(null);
    const columnMenuRef = useRef<HTMLDivElement | null>(null);

    const filteredAssets = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return assets;
        }

        return assets.filter((asset) => getSearchText(asset).includes(normalizedQuery));
    }, [assets, query]);

    const visibleData = useMemo(() => filteredAssets.slice(0, visibleAssetCount), [filteredAssets, visibleAssetCount]);
    const columns = useMemo(() => getAssetTableColumns(expandedIsins, setExpandedIsins), [expandedIsins]);

    const table = useReactTable({
        data: visibleData,
        columns,
        state: { sorting, columnVisibility },
        onSortingChange: setSorting,
        onColumnVisibilityChange: (updater) => {
            setColumnVisibility((current) => {
                const next = typeof updater === "function" ? updater(current) : updater;
                const forced = { ...next };

                for (const key of FIXED_COLUMNS) {
                    forced[key] = true;
                }

                saveAssetTableVisibleColumns(
                    ALL_COLUMNS.filter((key) => forced[key] !== false)
                );

                return forced;
            });
        },
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    const visibleColumns = table.getVisibleLeafColumns();
    const sortedAssets = table.getSortedRowModel().rows;
    const hasRows = sortedAssets.length > 0;
    const isSearchEmpty = !hasRows && query.trim().length > 0;
    const hasMoreAssets = visibleAssetCount < filteredAssets.length;

    const tableMinWidth = useMemo(() => {
        return visibleColumns.reduce((sum, column) => sum + getColumnMinWidth(column.id as AssetTableColumnKey), 0);
    }, [visibleColumns]);

    useEffect(() => {
        setVisibleAssetCount(revealBlockSize);
    }, [revealBlockSize]);

    useEffect(() => {
        const node = tableScrollRef.current;
        if (!node) return;

        function updateOverflowState() {
            const currentNode = tableScrollRef.current;
            if (!currentNode) return;
            setShowTopScrollbar(currentNode.scrollWidth > currentNode.clientWidth + 1);
        }

        updateOverflowState();
        const observer = new ResizeObserver(updateOverflowState);
        observer.observe(node);

        return () => observer.disconnect();
    }, [visibleColumns, sortedAssets.length, expandedIsins.length]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (!columnMenuRef.current?.contains(target)) {
                setShowColumnMenu(false);
            }
        }

        if (showColumnMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showColumnMenu]);

    return (
        <div className={styles.container} aria-busy={loading}>
            <div className={styles.toolbar}>
                <div className={styles.toolbarLeft}>
                    <div className={styles.toolbarTitle}>Geladener Stand</div>
                    <div className={styles.toolbarMeta}>
                        {loading
                            ? "Initiale Daten werden geladen"
                            : hasMoreAssets
                                ? `${visibleAssetCount} von ${filteredAssets.length} Treffern angezeigt · ${assets.length} Assets geladen`
                                : `${filteredAssets.length} von ${assets.length} Assets sichtbar`}
                    </div>
                </div>

                <div className={styles.toolbarRight}>
                    <input
                        className={`ui-input ${styles.searchInput}`}
                        type="search"
                        value={query}
                        onChange={(event) => {
                            setVisibleAssetCount(revealBlockSize);
                            setQuery(event.target.value);
                        }}
                        placeholder="Lokal suchen: Name, ISIN, WKN"
                        aria-label="Assets lokal suchen"
                        disabled={loading}
                    />
                    <div ref={columnMenuRef} className={styles.columnMenuWrap}>
                        <button
                            type="button"
                            className="ui-btn ui-btn-ghost"
                            aria-haspopup="menu"
                            aria-expanded={showColumnMenu}
                            aria-label="Spalteneinstellungen"
                            onClick={() => setShowColumnMenu((current) => !current)}
                            disabled={loading || !hasRows}
                        >
                            Einstellungen
                        </button>
                        {showColumnMenu ? (
                            <div className={styles.columnMenu} role="menu" aria-label="Sichtbare Spalten">
                                <div className={styles.columnMenuTitle}>Sichtbare Spalten</div>
                                <div className={styles.columnMenuList}>
                                    {table.getAllLeafColumns().filter((column) => TOGGLABLE_COLUMNS.includes(column.id as AssetTableColumnKey)).map((column) => (
                                        <label key={column.id} className={styles.columnMenuItem}>
                                            <input
                                                type="checkbox"
                                                checked={column.getIsVisible()}
                                                onChange={column.getToggleVisibilityHandler()}
                                            />
                                            <span>{String(column.columnDef.header)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                    {query ? (
                        <button
                            type="button"
                            className="ui-btn ui-btn-ghost"
                            onClick={() => {
                                setVisibleAssetCount(revealBlockSize);
                                setQuery("");
                            }}
                            disabled={loading}
                        >
                            Suche zurücksetzen
                        </button>
                    ) : null}
                </div>
            </div>

            {loading ? (
                <div className={styles.stateBox}>
                    <div className={styles.skeletonLine} />
                    <div className={styles.skeletonLineShort} />
                    <p>AssetTrace lädt den explizit angeforderten Parqet-Stand.</p>
                </div>
            ) : !hasRows ? (
                <div className={styles.stateBox}>
                    <strong>{isSearchEmpty ? "Keine Treffer für die lokale Suche" : emptyTitle}</strong>
                    <p>
                        {isSearchEmpty
                            ? "Passe den Suchbegriff an oder setze die Suche zurück. Es wird keine neue Provider-Anfrage ausgelöst."
                            : emptyDescription}
                    </p>
                </div>
            ) : (
                <>
                    {showTopScrollbar ? (
                        <div className={styles.topScrollbarWrap}>
                            <SyncedHorizontalScroll scrollTargetRef={tableScrollRef} />
                        </div>
                    ) : null}

                    <div ref={tableScrollRef} className={styles.tableScroll}>
                        <div className={styles.tableShell} style={{ minWidth: tableMinWidth }}>
                            <table className={styles.table}>
                                <thead>
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map((header) => {
                                                if (!header.column.getIsVisible()) {
                                                    return null;
                                                }

                                                const sorted = header.column.getIsSorted();

                                                return (
                                                    <th key={header.id}>
                                                        {header.column.getCanSort() ? (
                                                            <button
                                                                type="button"
                                                                className="ui-btn ui-btn-ghost"
                                                                onClick={header.column.getToggleSortingHandler()}
                                                            >
                                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                                <span className={styles.sortIndicator}>
                                                                    {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : ""}
                                                                </span>
                                                            </button>
                                                        ) : (
                                                            flexRender(header.column.columnDef.header, header.getContext())
                                                        )}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody>
                                    {sortedAssets.map((row) => {
                                        const isExpanded = expandedIsins.includes(row.original.isin);

                                        return (
                                            <Fragment key={row.id}>
                                                <tr>
                                                    {row.getVisibleCells().map((cell) => (
                                                        <td key={cell.id}>
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </td>
                                                    ))}
                                                </tr>
                                                {isExpanded ? renderExpandedRow(row.original, visibleColumns.length) : null}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {hasMoreAssets ? (
                        <div className={styles.revealFooter}>
                            <div>
                                {filteredAssets.length} lokale Treffer im geladenen Stand. Tabellenwerte und Summen beziehen sich
                                weiterhin auf den vollständigen geladenen Datenbestand.
                            </div>
                            <button
                                type="button"
                                className="ui-btn ui-btn-secondary"
                                onClick={() => setVisibleAssetCount((count) => count + revealBlockSize)}
                            >
                                Mehr lokale Assets anzeigen ({Math.min(revealBlockSize, filteredAssets.length - visibleAssetCount)} weitere)
                            </button>
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}
