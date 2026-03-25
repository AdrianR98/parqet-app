import type { RefObject } from "react";
import styles from "./AssetTable.module.css";
import type { ColumnConfig, ColumnKey, SortKey } from "./asset-table-config";

type AssetTableHeaderProps = {
    title: string;
    subtitle: string;
    hideHeader: boolean;
    showColumnMenu: boolean;
    onToggleColumnMenu: () => void;
    columnMenuRef: RefObject<HTMLDivElement | null>;
    selectableColumns: ColumnConfig[];
    visibleColumnSet: Set<ColumnKey>;
    onToggleColumn: (columnKey: ColumnKey) => void;
};

function ColumnSelector({
    showColumnMenu,
    onToggleColumnMenu,
    columnMenuRef,
    selectableColumns,
    visibleColumnSet,
    onToggleColumn,
}: Omit<AssetTableHeaderProps, "title" | "subtitle" | "hideHeader">) {
    return (
        <div className={styles.columnMenuWrap} ref={columnMenuRef}>
            <button
                type="button"
                className={styles.columnMenuButton}
                onClick={onToggleColumnMenu}
                aria-label="Spalten auswählen"
                aria-expanded={showColumnMenu}
            >
                ⚙
            </button>

            {showColumnMenu ? (
                <div className={styles.columnMenu}>
                    <div className={styles.columnMenuTitle}>Spalten</div>

                    <div className={styles.columnMenuList}>
                        {selectableColumns.map((column) => {
                            const checked = visibleColumnSet.has(column.key);

                            return (
                                <button
                                    key={column.key}
                                    type="button"
                                    className={styles.columnMenuItem}
                                    onClick={() => onToggleColumn(column.key)}
                                >
                                    <span
                                        className={`${styles.columnCheckbox} ${
                                            checked ? styles.columnCheckboxChecked : ""
                                        }`}
                                        aria-hidden="true"
                                    >
                                        ✓
                                    </span>

                                    <span>{column.label.replace("\n", " ")}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export function getHeaderButtonClassName(
    isActive: boolean,
    align: "left" | "right" = "left"
) {
    const classes = [styles.thButton];

    if (isActive) {
        classes.push(styles.thButtonActive);
    }

    if (align === "right") {
        classes.push(styles.thButtonRight);
    }

    return classes.join(" ");
}

export function AssetTableShellHeader({
    title,
    subtitle,
    hideHeader,
    ...columnSelectorProps
}: AssetTableHeaderProps) {
    if (hideHeader) {
        return (
            <div className={styles.compactToolbar}>
                <ColumnSelector {...columnSelectorProps} />
            </div>
        );
    }

    return (
        <div className={styles.header}>
            <div className={styles.headerTitleWrap}>
                <h3 className={styles.headerTitle}>{title}</h3>
                <p className={styles.headerSubtitle}>{subtitle}</p>
            </div>

            <div className={styles.headerRight}>
                <ColumnSelector {...columnSelectorProps} />
            </div>
        </div>
    );
}

type AssetTableHeadProps = {
    visibleColumnsConfig: ColumnConfig[];
    sortKey: SortKey;
    onSort: (sortKey: SortKey) => void;
};

export function AssetTableHead({
    visibleColumnsConfig,
    sortKey,
    onSort,
}: AssetTableHeadProps) {
    return (
        <thead>
            <tr>
                {visibleColumnsConfig.map((column) => (
                    <th
                        key={column.key}
                        style={{ width: column.width }}
                        className={column.align === "right" ? styles.tdRight : undefined}
                    >
                        {column.sortKey ? (
                            <button
                                type="button"
                                className={getHeaderButtonClassName(
                                    sortKey === column.sortKey,
                                    column.align
                                )}
                                onClick={() => onSort(column.sortKey!)}
                            >
                                <span className={styles.thLabel}>
                                    {column.label.split("\n").map((line, index) => (
                                        <span key={`${column.key}-${index}`}>
                                            {line}
                                            {index < column.label.split("\n").length - 1 ? <br /> : null}
                                        </span>
                                    ))}
                                </span>
                            </button>
                        ) : (
                            <span className={styles.thLabel}>{column.label}</span>
                        )}
                    </th>
                ))}

                <th className={styles.editHeaderCell} />
                <th className={styles.actionsHeaderCell} />
            </tr>
        </thead>
    );
}
