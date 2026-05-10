// src/components/dashboard/AssetTable.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./AssetTable.module.css";
import SyncedHorizontalScroll from "./SyncedHorizontalScroll";
import AssetTableHeader from "./AssetTableHeader";
import AssetTableRows from "./AssetTableRows";
import type { AssetSummary } from "../../lib/types";
import {
    DEFAULT_VISIBLE_COLUMNS,
    FIXED_COLUMNS,
    type AssetSortKey,
    type VisibleColumnKey,
    getColumnMinWidth,
    sortAssets,
} from "./asset-table-config";

type AssetTableProps = {
    assets: AssetSummary[];
    loading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
};

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

export default function AssetTable({
    assets,
    loading = false,
    emptyTitle = "Keine Assets im geladenen Stand",
    emptyDescription = "Passe die lokale Suche an oder lade Assets explizit neu, wenn du einen anderen Parqet-Stand erwartest.",
}: AssetTableProps) {
    const [visibleColumns, setVisibleColumns] =
        useState<VisibleColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
    const [sortKey, setSortKey] = useState<AssetSortKey>("positionValue");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [expandedIsins, setExpandedIsins] = useState<string[]>([]);
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [showTopScrollbar, setShowTopScrollbar] = useState(false);
    const [query, setQuery] = useState("");

    const tableScrollRef = useRef<HTMLDivElement | null>(null);
    const columnMenuRef = useRef<HTMLDivElement | null>(null);

    const normalizedVisibleColumns = useMemo(() => {
        const next = [...FIXED_COLUMNS];

        for (const key of visibleColumns) {
            if (!next.includes(key)) {
                next.push(key);
            }
        }

        return next;
    }, [visibleColumns]);

    const tableMinWidth = useMemo(() => {
        return normalizedVisibleColumns.reduce((sum, key) => {
            return sum + getColumnMinWidth(key);
        }, 0);
    }, [normalizedVisibleColumns]);

    const filteredAssets = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return assets;
        }

        return assets.filter((asset) => getSearchText(asset).includes(normalizedQuery));
    }, [assets, query]);

    const sortedAssets = useMemo(() => {
        return sortAssets(filteredAssets, sortKey, sortDirection);
    }, [filteredAssets, sortKey, sortDirection]);

    useEffect(() => {
        const node = tableScrollRef.current;
        if (!node) return;

        function updateOverflowState() {
            const currentNode = tableScrollRef.current;
            if (!currentNode) return;

            const hasOverflow = currentNode.scrollWidth > currentNode.clientWidth + 1;
            setShowTopScrollbar(hasOverflow);
        }

        updateOverflowState();

        const observer = new ResizeObserver(() => {
            updateOverflowState();
        });

        observer.observe(node);

        return () => observer.disconnect();
    }, [normalizedVisibleColumns, sortedAssets]);

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

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showColumnMenu]);

    function toggleColumnAction(key: VisibleColumnKey) {
        if (FIXED_COLUMNS.includes(key)) {
            return;
        }

        setVisibleColumns((current) =>
            current.includes(key)
                ? current.filter((entry) => entry !== key)
                : [...current, key]
        );
    }

    function sortAction(nextSortKey: AssetSortKey) {
        if (sortKey === nextSortKey) {
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
            return;
        }

        setSortKey(nextSortKey);
        setSortDirection("desc");
    }

    function toggleExpandedAction(isin: string) {
        setExpandedIsins((current) =>
            current.includes(isin)
                ? current.filter((entry) => entry !== isin)
                : [...current, isin]
        );
    }

    const hasRows = sortedAssets.length > 0;
    const isSearchEmpty = !hasRows && query.trim().length > 0;

    return (
        <div className={styles.container} aria-busy={loading}>
            <div className={styles.toolbar}>
                <div className={styles.toolbarLeft}>
                    <div className={styles.toolbarTitle}>Geladener Stand</div>
                    <div className={styles.toolbarMeta}>
                        {loading
                            ? "Initiale Daten werden geladen"
                            : `${sortedAssets.length} von ${assets.length} Assets sichtbar`}
                    </div>
                </div>

                <div className={styles.toolbarRight}>
                    <input
                        className={`ui-input ${styles.searchInput}`}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Lokal suchen: Name, ISIN, WKN"
                        aria-label="Assets lokal suchen"
                        disabled={loading}
                    />
                    {query ? (
                        <button
                            type="button"
                            className="ui-btn ui-btn-ghost"
                            onClick={() => setQuery("")}
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
                            <AssetTableHeader
                                visibleColumns={normalizedVisibleColumns}
                                sortKey={sortKey}
                                sortDirection={sortDirection}
                                showColumnMenu={showColumnMenu}
                                columnMenuRef={columnMenuRef}
                                onToggleColumnMenuAction={() =>
                                    setShowColumnMenu((current) => !current)
                                }
                                onToggleColumnAction={toggleColumnAction}
                                onSortAction={sortAction}
                            />

                            <AssetTableRows
                                assets={sortedAssets}
                                visibleColumns={normalizedVisibleColumns}
                                expandedIsins={expandedIsins}
                                onToggleExpandedAction={toggleExpandedAction}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
