import { useMemo, useState } from "react";
import {
    formatCurrency,
    formatShares,
    getAssetDisplayName,
    getAssetIconText,
    getAssetLogoUrl,
    getAssetSubtitle,
    getPnLClass,
} from "../../lib/format";
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
    | "portfolioCount"
    | "latestActivityAt";

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
};

const ALL_COLUMNS: ColumnConfig[] = [
    { key: "asset", label: "NAME", sortKey: "name" },
    { key: "netShares", label: "ANTEILE", sortKey: "netShares" },
    { key: "remainingCostBasis", label: "EINSTIEG\nPREIS", sortKey: "remainingCostBasis" },
    { key: "avgBuyPrice", label: "Ø KAUF", sortKey: "avgBuyPrice" },
    { key: "price", label: "POSITION\nKURS", sortKey: "price" },
    { key: "positionValue", label: "POSITIONSWERT", sortKey: "positionValue" },
    { key: "unrealizedPnL", label: "KURSGEWINN", sortKey: "unrealizedPnL" },
    { key: "totalDividendNet", label: "DIVIDENDEN", sortKey: "totalDividendNet" },
    { key: "portfolios", label: "PORTFOLIOS", sortKey: "portfolioCount" },
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
        case "latestActivityAt":
            return asset.latestActivityAt
                ? new Date(asset.latestActivityAt).getTime()
                : null;
        default:
            return null;
    }
}

function SortIndicator({
    active,
    direction,
}: {
    active: boolean;
    direction: SortDirection;
}) {
    return (
        <span className={styles.sortIndicator} aria-hidden="true">
            <span
                className={`${styles.sortTriangle} ${styles.sortTriangleUp} ${active && direction === "asc" ? styles.sortTriangleActive : ""
                    }`.trim()}
            />
            <span
                className={`${styles.sortTriangle} ${styles.sortTriangleDown} ${active && direction === "desc" ? styles.sortTriangleActive : ""
                    }`.trim()}
            />
        </span>
    );
}

function AssetIdentityCell({ asset }: { asset: AssetSummary }) {
    const [logoFailed, setLogoFailed] = useState(false);

    const displayName = getAssetDisplayName(asset);
    const subtitle = getAssetSubtitle(asset);
    const logoUrl = getAssetLogoUrl(asset);
    const iconText = getAssetIconText(asset);

    return (
        <div className={styles.assetCell}>
            <div className={styles.assetLogo}>
                {logoUrl && !logoFailed ? (
                    <img
                        src={logoUrl}
                        alt={displayName}
                        className={styles.assetLogoImage}
                        onError={() => setLogoFailed(true)}
                    />
                ) : (
                    <span className={styles.assetLogoFallback}>{iconText}</span>
                )}
            </div>

            <div className={styles.assetText}>
                <div className={styles.assetName}>{displayName}</div>
                <div className={styles.assetMeta}>{subtitle || asset.isin}</div>

                {asset.latestActivityAt ? (
                    <div className={styles.assetMeta}>
                        Letzte Aktivität:{" "}
                        {new Date(asset.latestActivityAt).toLocaleDateString("de-DE")}
                    </div>
                ) : null}
            </div>
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
                    <div className={styles.headerCount}>{sortedAssets.length} Positionen</div>

                    <div className={styles.columnMenuWrap}>
                        <button
                            type="button"
                            className={styles.columnMenuButton}
                            onClick={() => setShowColumnMenu((current) => !current)}
                            aria-label="Spalten auswählen"
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
                                                        }`.trim()}
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

                                    return (
                                        <th key={column.key}>
                                            {sortable ? (
                                                <button
                                                    type="button"
                                                    className={styles.thButton}
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

                                                    <SortIndicator
                                                        active={active}
                                                        direction={active ? sortDirection : "desc"}
                                                    />
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

                                    {visibleColumnSet.has("netShares") ? <td>{formatShares(asset.netShares)}</td> : null}
                                    {visibleColumnSet.has("remainingCostBasis") ? <td>{formatCurrency(asset.remainingCostBasis)}</td> : null}
                                    {visibleColumnSet.has("avgBuyPrice") ? <td>{formatCurrency(asset.avgBuyPrice)}</td> : null}
                                    {visibleColumnSet.has("price") ? <td>{formatCurrency(asset.marketPrice ?? asset.latestTradePrice)}</td> : null}
                                    {visibleColumnSet.has("positionValue") ? <td>{formatCurrency(asset.positionValue)}</td> : null}

                                    {visibleColumnSet.has("unrealizedPnL") ? (
                                        <td
                                            className={
                                                pnlClass === "positive"
                                                    ? styles.positive
                                                    : pnlClass === "negative"
                                                        ? styles.negative
                                                        : undefined
                                            }
                                        >
                                            {formatCurrency(asset.unrealizedPnL)}
                                        </td>
                                    ) : null}

                                    {visibleColumnSet.has("totalDividendNet") ? <td>{formatCurrency(asset.totalDividendNet)}</td> : null}

                                    {visibleColumnSet.has("portfolios") ? (
                                        <td>
                                            <div className={styles.badges}>
                                                {asset.portfolioNames.map((name) => (
                                                    <span key={name} className={styles.badge}>
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                    ) : null}
                                </tr>
                            );
                        })}

                        {sortedAssets.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.length}>
                                    <div className={styles.empty}>Keine Positionen vorhanden.</div>
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>
        </section>
    );
}