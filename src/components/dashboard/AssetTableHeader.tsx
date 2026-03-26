// src/components/dashboard/AssetTableHeader.tsx

"use client";

import styles from "./AssetTable.module.css";
import {
    FIXED_COLUMNS,
    getColumnLabel,
    type AssetSortKey,
    type VisibleColumnKey,
} from "./asset-table-config";

type AssetTableHeaderProps = {
    visibleColumns: VisibleColumnKey[];
    sortKey: AssetSortKey;
    sortDirection: "asc" | "desc";
    showColumnMenu: boolean;
    columnMenuRef: React.RefObject<HTMLDivElement | null>;
    onToggleColumnMenuAction: () => void;
    onToggleColumnAction: (key: VisibleColumnKey) => void;
    onSortAction: (key: AssetSortKey) => void;
};

/**
 * ============================================================
 * COMPONENT: ASSET TABLE HEADER
 * ============================================================
 *
 * Wichtig:
 * - Callback-Props enden bewusst auf "Action"
 * - dadurch verschwinden die TS71007 Hinweise
 */
const TOGGLABLE_COLUMNS: VisibleColumnKey[] = [
    "netShares",
    "avgBuyPrice",
    "latestTradePrice",
    "unrealizedPnL",
    "totalDividendNet",
    "latestActivityAt",
    "actions",
];

function isSortableColumn(key: VisibleColumnKey): key is AssetSortKey {
    return key !== "actions";
}

export default function AssetTableHeader({
    visibleColumns,
    sortKey,
    sortDirection,
    showColumnMenu,
    columnMenuRef,
    onToggleColumnMenuAction,
    onToggleColumnAction,
    onSortAction,
}: AssetTableHeaderProps) {
    return (
        <table className={styles.table}>
            <thead>
                <tr>
                    {visibleColumns.map((columnKey) => (
                        <th key={columnKey}>
                            {columnKey === "actions" ? (
                                <div className={styles.toolbarRight}>
                                    <div className={styles.columnMenuWrap} ref={columnMenuRef}>
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn-ghost"
                                            onClick={onToggleColumnMenuAction}
                                        >
                                            Spalten
                                        </button>

                                        {showColumnMenu ? (
                                            <div className={styles.columnMenu}>
                                                <div className={styles.columnMenuList}>
                                                    {TOGGLABLE_COLUMNS.filter(
                                                        (key) => !FIXED_COLUMNS.includes(key)
                                                    ).map((key) => (
                                                        <label
                                                            key={key}
                                                            className={styles.columnMenuItem}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={visibleColumns.includes(key)}
                                                                onChange={() =>
                                                                    onToggleColumnAction(key)
                                                                }
                                                            />
                                                            <span>{getColumnLabel(key)}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ) : isSortableColumn(columnKey) ? (
                                <button
                                    type="button"
                                    className="ui-btn ui-btn-ghost"
                                    onClick={() => onSortAction(columnKey)}
                                >
                                    {getColumnLabel(columnKey)}
                                    {sortKey === columnKey ? (
                                        <span>{sortDirection === "asc" ? "↑" : "↓"}</span>
                                    ) : null}
                                </button>
                            ) : (
                                getColumnLabel(columnKey)
                            )}
                        </th>
                    ))}
                </tr>
            </thead>
        </table>
    );
}