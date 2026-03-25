// src/components/dashboard/AssetTable.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency, formatShares, getPnLClass } from "../../lib/format";
import {
    getAssetDisplayName,
    getAssetInitials,
    getAssetLogoUrl,
    getAssetSubtitle,
} from "../../lib/asset-display";
import type { AssetSummary } from "../../lib/types";
import styles from "./AssetTable.module.css";

type AssetTableProps = {
    assets: AssetSummary[];
    title?: string;
    subtitle?: string;
};

type SortKey =
    | "name"
    | "netShares"
    | "remainingCostBasis"
    | "avgBuyPrice"
    | "price"
    | "positionValue"
    | "unrealizedPnL"
    | "totalDividendNet"
    | "portfolioCount";

type SortDirection = "asc" | "desc";

type ColumnKey =
    | "asset"
    | "netShares"
    | "remainingCostBasis"
    | "avgBuyPrice"
    | "price"
    | "positionValue"
    | "unrealizedPnL"
    | "totalDividendNet"
    | "portfolios";

type ColumnConfig = {
    key: ColumnKey;
    label: string;
    sortKey?: SortKey;
    align?: "left" | "right";
};

const ALL_COLUMNS: ColumnConfig[] = [
    { key: "asset", label: "NAME", sortKey: "name", align: "left" },
    { key: "netShares", label: "ANTEILE", sortKey: "netShares", align: "right" },
    {
        key: "remainingCostBasis",
        label: "EINSTIEG\nPREIS",
        sortKey: "remainingCostBasis",
        align: "right",
    },
    { key: "avgBuyPrice", label: "Ø KAUF", sortKey: "avgBuyPrice", align: "right" },
    { key: "price", label: "POSITION\nKURS", sortKey: "price", align: "right" },
    {
        key: "positionValue",
        label: "POSITIONSWERT",
        sortKey: "positionValue",
        align: "right",
    },
    {
        key: "unrealizedPnL",
        label: "KURSGEWINN",
        sortKey: "unrealizedPnL",
        align: "right",
    },
    {
        key: "totalDividendNet",
        label: "DIVIDENDEN",
        sortKey: "totalDividendNet",
        align: "right",
    },
    {
        key: "portfolios",
        label: "PORTFOLIOS",
        sortKey: "portfolioCount",
        align: "left",
    },
];

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
    "asset",
    "netShares",
    "remainingCostBasis",
    "avgBuyPrice",
    "price",
    "positionValue",
    "unrealizedPnL",
    "totalDividendNet",
    "portfolios",
];

function compareNullableNumbers(
    a: number | null | undefined,
    b: number | null | undefined
) {
    const left = a ?? Number.NEGATIVE_INFINITY;
    const right = b ?? Number.NEGATIVE_INFINITY;

    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

function getSortValue(asset: AssetSummary, sortKey: SortKey): string | number | null {
    switch (sortKey) {
        case "name":
            return getAssetDisplayName(asset).toLowerCase();

        case "netShares":
            return asset.netShares;

        case "remainingCostBasis":
            return asset.remainingCostBasis;

        case "avgBuyPrice":
            return asset.avgBuyPrice;

        case "price":
            return asset.marketPrice ?? asset.latestTradePrice;

        case "positionValue":
            return asset.positionValue;

        case "unrealizedPnL":
            return asset.unrealizedPnL;

        case "totalDividendNet":
            return asset.totalDividendNet;

        case "portfolioCount":
            return asset.portfolioNames.length;

        default:
            return null;
    }
}

/**
 * Keine sichtbaren Dreiecke.
 * Der aktive Sort-Status wird nur ueber Farbe und Schriftgewicht im Header gezeigt.
 */
function getHeaderButtonClassName(
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

/**
 * Linke Asset-Zelle im kompakteren Parqet-aehnlichen Stil.
 *
 * Wichtig:
 * - keine "Letzte Aktivitaet"-Zeile mehr
 * - Titel und Subtitle bewusst enger zusammen
 * - Subtitle bleibt robust ueber asset-display.ts
 */
function AssetIdentityCell({ asset }: { asset: AssetSummary }) {
    const [logoFailed, setLogoFailed] = useState(false);

    const displayName = getAssetDisplayName(asset);
    const subtitle = getAssetSubtitle(asset);
    const logoUrl = getAssetLogoUrl(asset);
    const initials = getAssetInitials(asset);

    return (
        <div className={styles.assetIdentity}>
            <div className={styles.assetLogo}>
                {logoUrl && !logoFailed ? (
                    <img
                        src={logoUrl}
                        alt={`${displayName} Logo`}
                        className={styles.assetLogoImage}
                        onError={() => setLogoFailed(true)}
                    />
                ) : (
                    <div className={styles.assetLogoFallback} aria-hidden="true">
                        {initials}
                    </div>
                )}
            </div>

            <div className={styles.assetText}>
                <div className={styles.assetHeadlineRow}>
                    <span className={styles.assetCategory}>Aktie</span>
                    <span className={styles.assetMetaDivider}>·</span>
                    <span className={styles.assetSubtitleInline}>{subtitle}</span>
                </div>

                <div className={styles.assetName}>{displayName}</div>
            </div>
        </div>
    );
}

/**
 * Kompakter Portfolio-Hinweis.
 *
 * Solange noch kein echtes portfolioBreakdown vorhanden ist, zeigen wir
 * die zugeordneten Portfolios bewusst schlank und zeilenbasiert statt
 * als breite Badge-Wolke. Das wirkt naeher an Parqet und spart Hoehe.
 */
function PortfolioListCell({ asset }: { asset: AssetSummary }) {
    if (asset.portfolioNames.length === 0) {
        return <span className={styles.portfolioEmpty}>—</span>;
    }

    return (
        <div className={styles.portfolioListCompact}>
            {asset.portfolioNames.map((name) => (
                <div key={name} className={styles.portfolioLine}>
                    {name}
                </div>
            ))}
        </div>
    );
}

export default function AssetTable({
    assets,
    title = "Assets",
    subtitle = "Konsolidierte Positionen über alle ausgewählten Portfolios",
}: AssetTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>("positionValue");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [visibleColumns, setVisibleColumns] =
        useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);

    const columnMenuRef = useRef<HTMLDivElement | null>(null);

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

    function handleSort(nextSortKey: SortKey) {
        if (sortKey === nextSortKey) {
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
            return;
        }

        setSortKey(nextSortKey);
        setSortDirection("desc");
    }

    function toggleColumn(columnKey: ColumnKey) {
        setVisibleColumns((current) => {
            if (current.includes(columnKey)) {
                if (current.length === 1) {
                    return current;
                }

                return current.filter((key) => key !== columnKey);
            }

            return ALL_COLUMNS.filter((column) =>
                [...current, columnKey].includes(column.key)
            ).map((column) => column.key);
        });
    }

    const visibleColumnSet = useMemo(() => new Set(visibleColumns), [visibleColumns]);

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
        <section className={styles.card}>
            <div className={styles.header}>
                <div className={styles.headerTitleWrap}>
                    <h2 className={styles.headerTitle}>{title}</h2>
                    <div className={styles.headerSubtitle}>{subtitle}</div>
                </div>

                <div className={styles.headerRight}>
                    <span className={styles.headerCount}>{sortedAssets.length} Positionen</span>

                    <div className={styles.columnMenuWrap} ref={columnMenuRef}>
                        <button
                            type="button"
                            className={styles.columnMenuButton}
                            onClick={() => setShowColumnMenu((current) => !current)}
                            aria-label="Spalten auswählen"
                            aria-expanded={showColumnMenu}
                        >
                            ⚙
                        </button>

                        {showColumnMenu ? (
                            <div className={styles.columnMenu}>
                                <div className={styles.columnMenuTitle}>Spalten</div>

                                <div className={styles.columnMenuList}>
                                    {ALL_COLUMNS.map((column) => {
                                        const checked = visibleColumnSet.has(column.key);

                                        return (
                                            <button
                                                key={column.key}
                                                type="button"
                                                className={styles.columnMenuItem}
                                                onClick={() => toggleColumn(column.key)}
                                            >
                                                <span
                                                    className={`${styles.columnCheckbox} ${checked ? styles.columnCheckboxChecked : ""
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
                </div>
            </div>

            <div className={styles.wrap}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            {ALL_COLUMNS.filter((column) => visibleColumnSet.has(column.key)).map(
                                (column) => {
                                    const sortable = Boolean(column.sortKey);
                                    const active = column.sortKey === sortKey;
                                    const align = column.align ?? "left";

                                    return (
                                        <th
                                            key={column.key}
                                            aria-sort={
                                                active
                                                    ? sortDirection === "asc"
                                                        ? "ascending"
                                                        : "descending"
                                                    : "none"
                                            }
                                        >
                                            {sortable ? (
                                                <button
                                                    type="button"
                                                    className={getHeaderButtonClassName(active, align)}
                                                    onClick={() => handleSort(column.sortKey!)}
                                                >
                                                    <span className={styles.thLabel}>
                                                        {column.label.split("\n").map((part, index, arr) => (
                                                            <span key={`${column.key}-${index}`}>
                                                                {part}
                                                                {index < arr.length - 1 ? <br /> : null}
                                                            </span>
                                                        ))}
                                                    </span>
                                                </button>
                                            ) : (
                                                <span className={styles.thLabel}>{column.label}</span>
                                            )}
                                        </th>
                                    );
                                }
                            )}
                        </tr>
                    </thead>

                    <tbody>
                        {sortedAssets.map((asset) => {
                            const pnlClass = getPnLClass(asset.unrealizedPnL);

                            return (
                                <tr key={asset.isin}>
                                    {visibleColumnSet.has("asset") ? (
                                        <td>
                                            <AssetIdentityCell asset={asset} />
                                        </td>
                                    ) : null}

                                    {visibleColumnSet.has("netShares") ? (
                                        <td className={styles.tdRight}>{formatShares(asset.netShares)}</td>
                                    ) : null}

                                    {visibleColumnSet.has("remainingCostBasis") ? (
                                        <td className={styles.tdRight}>
                                            {formatCurrency(asset.remainingCostBasis)}
                                        </td>
                                    ) : null}

                                    {visibleColumnSet.has("avgBuyPrice") ? (
                                        <td className={styles.tdRight}>
                                            {formatCurrency(asset.avgBuyPrice)}
                                        </td>
                                    ) : null}

                                    {visibleColumnSet.has("price") ? (
                                        <td className={styles.tdRight}>
                                            {formatCurrency(asset.marketPrice ?? asset.latestTradePrice)}
                                        </td>
                                    ) : null}

                                    {visibleColumnSet.has("positionValue") ? (
                                        <td className={styles.tdRight}>
                                            {formatCurrency(asset.positionValue)}
                                        </td>
                                    ) : null}

                                    {visibleColumnSet.has("unrealizedPnL") ? (
                                        <td className={`${styles.tdRight} ${styles[pnlClass] ?? ""}`}>
                                            {formatCurrency(asset.unrealizedPnL)}
                                        </td>
                                    ) : null}

                                    {visibleColumnSet.has("totalDividendNet") ? (
                                        <td className={styles.tdRight}>
                                            {formatCurrency(asset.totalDividendNet)}
                                        </td>
                                    ) : null}

                                    {visibleColumnSet.has("portfolios") ? (
                                        <td>
                                            <PortfolioListCell asset={asset} />
                                        </td>
                                    ) : null}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {sortedAssets.length === 0 ? (
                    <div className={styles.empty}>Keine Positionen vorhanden.</div>
                ) : null}
            </div>
        </section>
    );
}