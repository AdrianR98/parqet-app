// ============================================================
// src/components/dashboard/AssetTable.tsx
// ------------------------------------------------------------
// Schlanke Orchestrierungs-Komponente fuer die Asset-Tabelle.
//
// Ziele dieses Refactors:
// - Render-Logik, Konfiguration und Tabellenzeilen trennen
// - Datei deutlich kuerzer und wartbarer machen
// - bestehende Optik/Funktionalitaet beibehalten
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import type { AssetSummary } from "../../lib/types";
import SyncedHorizontalScroll from "./SyncedHorizontalScroll";
import styles from "./AssetTable.module.css";
import {
    ALL_COLUMNS,
    compareNullableNumbers,
    DEFAULT_VISIBLE_COLUMNS,
    EDIT_ACTION_WIDTH,
    EXPAND_ACTION_WIDTH,
    FIXED_COLUMNS,
    getSortValue,
    type ColumnKey,
    type SortDirection,
    type SortKey,
} from "./asset-table-config";
import { AssetTableBody } from "./AssetTableRows";
import { AssetTableHead, AssetTableShellHeader } from "./AssetTableHeader";
import { getAssetDisplayName } from "../../lib/asset-display";

type AssetTableProps = {
    assets: AssetSummary[];
    title?: string;
    subtitle?: string;
    onAuditAsset?: (asset: AssetSummary) => void;
    hideHeader?: boolean;
};

export default function AssetTable({
    assets,
    onAuditAsset,
    title = "Assets",
    subtitle = "Konsolidierte Positionen über alle ausgewählten Portfolios",
    hideHeader = false,
}: AssetTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("positionValue");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [visibleColumns, setVisibleColumns] =
        useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
    const [expandedIsins, setExpandedIsins] = useState<Set<string>>(new Set());
    const [showTopScrollbar, setShowTopScrollbar] = useState(false);

    const columnMenuRef = useRef<HTMLDivElement | null>(null);
    const tableScrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                columnMenuRef.current &&
                !columnMenuRef.current.contains(event.target as Node)
            ) {
                setShowColumnMenu(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const visibleColumnSet = useMemo(() => new Set(visibleColumns), [visibleColumns]);

    const visibleColumnsConfig = useMemo(
        () => ALL_COLUMNS.filter((column) => visibleColumnSet.has(column.key)),
        [visibleColumnSet]
    );

    const selectableColumns = useMemo(
        () => ALL_COLUMNS.filter((column) => !column.isFixed),
        []
    );

    const tableMinWidth = useMemo(() => {
        const visibleColumnsWidth = visibleColumnsConfig.reduce(
            (sum, column) => sum + column.width,
            0
        );

        return visibleColumnsWidth + EDIT_ACTION_WIDTH + EXPAND_ACTION_WIDTH;
    }, [visibleColumnsConfig]);

    useEffect(() => {
        const element = tableScrollRef.current;

        if (!element) {
            return;
        }

        const updateOverflowState = () => {
            setShowTopScrollbar(element.scrollWidth > element.clientWidth + 1);
        };

        updateOverflowState();

        const resizeObserver = new ResizeObserver(() => {
            updateOverflowState();
        });

        resizeObserver.observe(element);

        return () => {
            resizeObserver.disconnect();
        };
    }, [tableMinWidth, assets.length, visibleColumnsConfig.length]);

    function handleSort(nextSortKey: SortKey) {
        if (sortKey === nextSortKey) {
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
            return;
        }

        setSortKey(nextSortKey);
        setSortDirection("desc");
    }

    function toggleColumn(columnKey: ColumnKey) {
        if (FIXED_COLUMNS.includes(columnKey)) {
            return;
        }

        setVisibleColumns((current) => {
            if (current.includes(columnKey)) {
                return current.filter((key) => key !== columnKey);
            }

            const merged = [...current, columnKey];

            return ALL_COLUMNS.filter((column) => merged.includes(column.key)).map(
                (column) => column.key
            );
        });
    }

    function toggleExpanded(isin: string) {
        setExpandedIsins((current) => {
            const next = new Set(current);

            if (next.has(isin)) {
                next.delete(isin);
            } else {
                next.add(isin);
            }

            return next;
        });
    }

    const sortedAssets = useMemo(() => {
        const cloned = [...assets];

        cloned.sort((a, b) => {
            const aValue = getSortValue(a, sortKey);
            const bValue = getSortValue(b, sortKey);

            let result = 0;

            if (typeof aValue === "string" && typeof bValue === "string") {
                result = aValue.localeCompare(bValue, "de");
            } else {
                result = compareNullableNumbers(
                    typeof aValue === "number" ? aValue : null,
                    typeof bValue === "number" ? bValue : null
                );
            }

            if (result === 0) {
                result = compareNullableNumbers(a.positionValue, b.positionValue);
            }

            if (result === 0) {
                result = getAssetDisplayName(a).localeCompare(getAssetDisplayName(b), "de");
            }

            return sortDirection === "asc" ? result : result * -1;
        });

        return cloned;
    }, [assets, sortKey, sortDirection]);

    return (
        <section className={`${styles.tableShell} ${hideHeader ? styles.tableShellFlat : ""}`}>
            <AssetTableShellHeader
                title={title}
                subtitle={subtitle}
                hideHeader={hideHeader}
                showColumnMenu={showColumnMenu}
                onToggleColumnMenu={() => setShowColumnMenu((current) => !current)}
                columnMenuRef={columnMenuRef}
                selectableColumns={selectableColumns}
                visibleColumnSet={visibleColumnSet}
                onToggleColumn={toggleColumn}
            />

            {showTopScrollbar ? (
                <SyncedHorizontalScroll scrollTargetRef={tableScrollRef} />
            ) : null}

            <div ref={tableScrollRef} className={styles.wrap}>
                <table className={styles.table} style={{ minWidth: tableMinWidth }}>
                    <AssetTableHead
                        visibleColumnsConfig={visibleColumnsConfig}
                        sortKey={sortKey}
                        onSort={handleSort}
                    />

                    <AssetTableBody
                        assets={sortedAssets}
                        visibleColumnSet={visibleColumnSet}
                        expandedIsins={expandedIsins}
                        onToggleExpanded={toggleExpanded}
                        onAuditAsset={onAuditAsset}
                    />
                </table>

                {sortedAssets.length === 0 ? (
                    <div className={styles.empty}>Keine Positionen vorhanden.</div>
                ) : null}
            </div>
        </section>
    );
}
