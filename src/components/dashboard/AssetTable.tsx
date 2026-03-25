// src/components/dashboard/AssetTable.tsx

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency, formatShares, getPnLClass } from "../../lib/format";
import {
    getAssetDisplayName,
    getAssetInitials,
    getAssetLogoUrl,
    getAssetSubtitle,
} from "../../lib/asset-display";
import type { AssetSummary, PortfolioPosition } from "../../lib/types";
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

function getSafePortfolioBreakdown(asset: AssetSummary): PortfolioPosition[] {
    if (Array.isArray(asset.portfolioBreakdown)) {
        return asset.portfolioBreakdown;
    }

    const portfolioIds = Array.isArray(asset.portfolioIds) ? asset.portfolioIds : [];
    const portfolioNames = Array.isArray(asset.portfolioNames) ? asset.portfolioNames : [];

    if (portfolioNames.length === 0 && portfolioIds.length === 0) {
        return [];
    }

    const maxLength = Math.max(portfolioIds.length, portfolioNames.length);

    return Array.from({ length: maxLength }, (_, index) => ({
        portfolioId: portfolioIds[index] ?? `fallback-portfolio-${index}`,
        portfolioName:
            portfolioNames[index] ?? portfolioIds[index] ?? `Portfolio ${index + 1}`,
        netShares: 0,
        remainingCostBasis: 0,
        avgBuyPrice: null,
        latestTradePrice: null,
        marketPrice: null,
        positionValue: null,
        unrealizedPnL: null,
        totalDividendNet: 0,
    }));
}

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
    const portfolioBreakdown = getSafePortfolioBreakdown(asset);

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
            return portfolioBreakdown.length;
        default:
            return null;
    }
}

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

function formatPercentage(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
        return "—";
    }

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(value);
}

function getPortfolioShareOfAsset(
    portfolio: PortfolioPosition,
    asset: AssetSummary
): number | null {
    const totalPositionValue = asset.positionValue ?? null;
    const portfolioPositionValue = portfolio.positionValue ?? null;

    if (
        totalPositionValue == null ||
        portfolioPositionValue == null ||
        totalPositionValue <= 0
    ) {
        return null;
    }

    return (portfolioPositionValue / totalPositionValue) * 100;
}

function AssetIdentityCell({
    asset,
    isExpanded,
    canExpand,
    onToggleExpand,
    portfolioCount,
}: {
    asset: AssetSummary;
    isExpanded: boolean;
    canExpand: boolean;
    onToggleExpand: () => void;
    portfolioCount: number;
}) {
    const [logoFailed, setLogoFailed] = useState(false);

    const displayName = getAssetDisplayName(asset);
    const subtitle = getAssetSubtitle(asset);
    const logoUrl = getAssetLogoUrl(asset);
    const initials = getAssetInitials(asset);

    return (
        <div className={styles.assetIdentity}>
            {canExpand ? (
                <button
                    type="button"
                    className={styles.expandButton}
                    onClick={onToggleExpand}
                    aria-label={isExpanded ? "Portfolio-Details einklappen" : "Portfolio-Details aufklappen"}
                    aria-expanded={isExpanded}
                >
                    <span
                        className={`${styles.expandChevron} ${isExpanded ? styles.expandChevronOpen : ""
                            }`}
                        aria-hidden="true"
                    >
                        ▾
                    </span>
                </button>
            ) : (
                <div className={styles.expandSpacer} aria-hidden="true" />
            )}

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
                    {portfolioCount > 1 ? (
                        <>
                            <span className={styles.assetMetaDivider}>·</span>
                            <span className={styles.assetPortfolioCount}>
                                {portfolioCount} Portfolios
                            </span>
                        </>
                    ) : null}
                </div>

                <div className={styles.assetName}>{displayName}</div>
            </div>
        </div>
    );
}

function PortfolioRowIdentityCell({
    portfolio,
    asset,
}: {
    portfolio: PortfolioPosition;
    asset: AssetSummary;
}) {
    const share = getPortfolioShareOfAsset(portfolio, asset);

    return (
        <div className={styles.portfolioIdentity}>
            <div className={styles.portfolioIndent} aria-hidden="true" />
            <div className={styles.portfolioText}>
                <div className={styles.portfolioPrefixRow}>
                    <span className={styles.portfolioPrefix}>Aus Portfolio</span>
                    {share !== null ? (
                        <span className={styles.portfolioShareBadge}>
                            {formatPercentage(share)} %
                        </span>
                    ) : null}
                </div>

                <div className={styles.portfolioName}>{portfolio.portfolioName}</div>
            </div>
        </div>
    );
}

function renderMainAssetCell(
    asset: AssetSummary,
    expandedIsins: Set<string>,
    toggleExpanded: (isin: string) => void
) {
    const portfolioBreakdown = getSafePortfolioBreakdown(asset);
    const canExpand = portfolioBreakdown.length > 1;
    const isExpanded = expandedIsins.has(asset.isin);

    return (
        <AssetIdentityCell
            asset={asset}
            isExpanded={isExpanded}
            canExpand={canExpand}
            onToggleExpand={() => toggleExpanded(asset.isin)}
            portfolioCount={portfolioBreakdown.length}
        />
    );
}

function renderPortfolioListSummary(asset: AssetSummary) {
    const portfolioBreakdown = getSafePortfolioBreakdown(asset);

    if (portfolioBreakdown.length === 0) {
        return <span className={styles.portfolioEmpty}>—</span>;
    }

    if (portfolioBreakdown.length === 1) {
        return (
            <span className={styles.portfolioSingleName}>
                {portfolioBreakdown[0].portfolioName}
            </span>
        );
    }

    return (
        <div className={styles.portfolioSummaryStack}>
            {portfolioBreakdown.slice(0, 2).map((portfolio) => (
                <div key={portfolio.portfolioId} className={styles.portfolioSummaryLine}>
                    {portfolio.portfolioName}
                </div>
            ))}
            {portfolioBreakdown.length > 2 ? (
                <div className={styles.portfolioMoreLine}>
                    +{portfolioBreakdown.length - 2} weitere
                </div>
            ) : null}
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
    const [expandedIsins, setExpandedIsins] = useState<Set<string>>(new Set());

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
                            const portfolioBreakdown = getSafePortfolioBreakdown(asset);
                            const isExpanded = expandedIsins.has(asset.isin);
                            const showPortfolioRows = portfolioBreakdown.length > 1 && isExpanded;

                            return (
                                <Fragment key={asset.isin}>
                                    <tr className={styles.assetMainRow}>
                                        {visibleColumnSet.has("asset") ? (
                                            <td>
                                                {renderMainAssetCell(asset, expandedIsins, toggleExpanded)}
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
                                            <td>{renderPortfolioListSummary(asset)}</td>
                                        ) : null}
                                    </tr>

                                    {showPortfolioRows
                                        ? portfolioBreakdown.map((portfolio) => {
                                            const portfolioPnLClass = getPnLClass(portfolio.unrealizedPnL);

                                            return (
                                                <tr
                                                    key={`${asset.isin}-${portfolio.portfolioId}`}
                                                    className={styles.portfolioSubRow}
                                                >
                                                    {visibleColumnSet.has("asset") ? (
                                                        <td>
                                                            <PortfolioRowIdentityCell portfolio={portfolio} asset={asset} />
                                                        </td>
                                                    ) : null}

                                                    {visibleColumnSet.has("netShares") ? (
                                                        <td className={`${styles.tdRight} ${styles.subtleValue}`}>
                                                            {formatShares(portfolio.netShares)}
                                                        </td>
                                                    ) : null}

                                                    {visibleColumnSet.has("remainingCostBasis") ? (
                                                        <td className={`${styles.tdRight} ${styles.subtleValue}`}>
                                                            {formatCurrency(portfolio.remainingCostBasis)}
                                                        </td>
                                                    ) : null}

                                                    {visibleColumnSet.has("avgBuyPrice") ? (
                                                        <td className={`${styles.tdRight} ${styles.subtleValue}`}>
                                                            {formatCurrency(portfolio.avgBuyPrice)}
                                                        </td>
                                                    ) : null}

                                                    {visibleColumnSet.has("price") ? (
                                                        <td className={`${styles.tdRight} ${styles.subtleValue}`}>
                                                            {formatCurrency(
                                                                portfolio.marketPrice ?? portfolio.latestTradePrice
                                                            )}
                                                        </td>
                                                    ) : null}

                                                    {visibleColumnSet.has("positionValue") ? (
                                                        <td className={`${styles.tdRight} ${styles.subtleValue}`}>
                                                            {formatCurrency(portfolio.positionValue)}
                                                        </td>
                                                    ) : null}

                                                    {visibleColumnSet.has("unrealizedPnL") ? (
                                                        <td
                                                            className={`${styles.tdRight} ${styles.subtleValue} ${styles[portfolioPnLClass] ?? ""
                                                                }`}
                                                        >
                                                            {formatCurrency(portfolio.unrealizedPnL)}
                                                        </td>
                                                    ) : null}

                                                    {visibleColumnSet.has("totalDividendNet") ? (
                                                        <td className={`${styles.tdRight} ${styles.subtleValue}`}>
                                                            {formatCurrency(portfolio.totalDividendNet)}
                                                        </td>
                                                    ) : null}

                                                    {visibleColumnSet.has("portfolios") ? (
                                                        <td>
                                                            <span className={styles.portfolioSubRowLabel}>
                                                                Anteil am Asset
                                                            </span>
                                                        </td>
                                                    ) : null}
                                                </tr>
                                            );
                                        })
                                        : null}
                                </Fragment>
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