"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GlobalAssetViewModel } from "../../lib/types";
import AssetTable from "./AssetTable";
import styles from "./CollapsibleAssetTableSection.module.css";
import { loadAssetTableVisibleColumns, saveAssetTableVisibleColumns } from "../../lib/app-settings";
import type { AssetTableColumnKey } from "./asset-table-columns";

type Props = {
    title: string;
    subtitle?: string;
    assets: GlobalAssetViewModel[];
    loading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    defaultExpanded?: boolean;
};

const FIXED_COLUMNS: AssetTableColumnKey[] = ["name", "positionValue", "actions"];
const ALL_COLUMNS: AssetTableColumnKey[] = ["name", "remainingCostBasis", "positionValue", "unrealizedPnL", "totalDividendNet", "allocation", "actions"];
const DEFAULT_VISIBLE_COLUMNS: AssetTableColumnKey[] = ["name", "remainingCostBasis", "positionValue", "unrealizedPnL", "totalDividendNet", "allocation", "actions"];
const TOGGLABLE_COLUMNS = ALL_COLUMNS.filter((key) => !FIXED_COLUMNS.includes(key));
const COLUMN_LABELS: Record<AssetTableColumnKey, string> = {
    name: "Name",
    remainingCostBasis: "Einstand",
    positionValue: "Positionswert",
    unrealizedPnL: "Gewinn / Verlust",
    totalDividendNet: "Dividenden",
    allocation: "Allokation",
    actions: "Steuerung",
};

export default function CollapsibleAssetTableSection({ title, subtitle, assets, loading = false, emptyTitle, emptyDescription, defaultExpanded = true }: Props) {
    const [open, setOpen] = useState(defaultExpanded);
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState<AssetTableColumnKey[]>(() => loadAssetTableVisibleColumns(ALL_COLUMNS, DEFAULT_VISIBLE_COLUMNS, FIXED_COLUMNS) as AssetTableColumnKey[]);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        function handleOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (!menuRef.current?.contains(target)) {
                setShowColumnMenu(false);
            }
        }

        if (showColumnMenu) {
            document.addEventListener("mousedown", handleOutside);
        }

        return () => document.removeEventListener("mousedown", handleOutside);
    }, [showColumnMenu]);

    const selectedSet = useMemo(() => new Set(visibleColumns), [visibleColumns]);

    function toggleColumn(column: AssetTableColumnKey) {
        const next = selectedSet.has(column)
            ? visibleColumns.filter((entry) => entry !== column)
            : [...visibleColumns, column];
        saveAssetTableVisibleColumns(next);
        setVisibleColumns(loadAssetTableVisibleColumns(ALL_COLUMNS, DEFAULT_VISIBLE_COLUMNS, FIXED_COLUMNS) as AssetTableColumnKey[]);
    }

    return (
        <section className={styles.section}>
            <div className={styles.headerRow}>
                <button type="button" className={styles.header} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
                    <div className={styles.headerLeft}>
                        <div className={styles.titleRow}><h2 className={styles.title}>{title}</h2><span className={styles.count}>{loading ? "Lädt" : assets.length}</span></div>
                        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
                    </div>
                    <span className={`${styles.chevron} ${open ? styles.open : ""}`}>▾</span>
                </button>
                <div className={styles.menuWrap} ref={menuRef}>
                    <button type="button" className="ui-icon-btn" aria-label="Spalteneinstellungen" aria-haspopup="menu" aria-expanded={showColumnMenu} onClick={() => setShowColumnMenu((current) => !current)}>⚙</button>
                    {showColumnMenu ? (
                        <div className={styles.menu} role="menu" aria-label="Sichtbare Spalten">
                            <div className={styles.menuTitle}>Spalten anzeigen</div>
                            {TOGGLABLE_COLUMNS.map((column) => (
                                <label key={column} className={styles.menuItem}>
                                    <input type="checkbox" checked={selectedSet.has(column)} onChange={() => toggleColumn(column)} />
                                    <span>{COLUMN_LABELS[column]}</span>
                                </label>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
            {open ? <div className={styles.content}><AssetTable assets={assets} loading={loading} emptyTitle={emptyTitle} emptyDescription={emptyDescription} /></div> : null}
        </section>
    );
}

