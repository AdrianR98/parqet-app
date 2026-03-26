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
    onAuditAssetAction?: (asset: AssetSummary) => void | Promise<void>;
};

/**
 * ============================================================
 * COMPONENT: ASSET TABLE
 * ============================================================
 *
 * Wichtig:
 * - Prop-Namen enden bewusst auf "Action"
 * - das reduziert die Next TS71007 Hinweise in Client-Entry-Dateien
 *
 * Typische Erweiterungspunkte:
 * - persistente Spaltenprofile
 * - serverseitige Sortierung
 * - zusätzliche Tabellenaktionen
 */
export default function AssetTable({
    assets,
    onAuditAssetAction,
}: AssetTableProps) {
    const [visibleColumns, setVisibleColumns] =
        useState<VisibleColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
    const [sortKey, setSortKey] = useState<AssetSortKey>("positionValue");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [expandedIsins, setExpandedIsins] = useState<string[]>([]);
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [showTopScrollbar, setShowTopScrollbar] = useState(false);

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

    const sortedAssets = useMemo(() => {
        return sortAssets(assets, sortKey, sortDirection);
    }, [assets, sortKey, sortDirection]);

    /**
     * ------------------------------------------------------------
     * OVERFLOW-CHECK
     * ------------------------------------------------------------
     */
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

    /**
     * ------------------------------------------------------------
     * OUTSIDE CLICK COLUMN MENU
     * ------------------------------------------------------------
     */
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

    return (
        <div className={styles.container}>
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
                        onAuditAssetAction={onAuditAssetAction}
                    />
                </div>
            </div>
        </div>
    );
}