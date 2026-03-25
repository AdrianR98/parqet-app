import { Fragment, useState } from "react";
import { formatCurrency, formatShares, getPnLClass } from "../../lib/format";
import {
    getAssetDisplayName,
    getAssetInitials,
    getAssetLogoUrl,
    getAssetSubtitle,
} from "../../lib/asset-display";
import type { AssetSummary, PortfolioPosition } from "../../lib/types";
import styles from "./AssetTable.module.css";
import type { ColumnKey } from "./asset-table-config";
import { getSafePortfolioBreakdown } from "./asset-table-config";

type SharedRowProps = {
    visibleColumnSet: Set<ColumnKey>;
};

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
    portfolioCount,
}: {
    asset: AssetSummary;
    portfolioCount: number;
}) {
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

                    {portfolioCount > 1 ? (
                        <>
                            <span className={styles.assetMetaDivider}>·</span>
                            <span className={styles.assetPortfolioCount}>
                                {portfolioCount} Portfolios
                            </span>
                        </>
                    ) : null}
                </div>

                <div className={styles.assetNameRow}>
                    <div className={styles.assetName}>{displayName}</div>
                </div>
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

function AssetValueCells({
    asset,
    visibleColumnSet,
}: {
    asset: AssetSummary;
} & SharedRowProps) {
    const pnlClass = getPnLClass(asset.unrealizedPnL);

    return (
        <>
            {visibleColumnSet.has("asset") ? (
                <td>
                    <AssetIdentityCell
                        asset={asset}
                        portfolioCount={getSafePortfolioBreakdown(asset).length}
                    />
                </td>
            ) : null}

            {visibleColumnSet.has("netShares") ? (
                <td className={styles.tdRight}>{formatShares(asset.netShares)}</td>
            ) : null}

            {visibleColumnSet.has("remainingCostBasis") ? (
                <td className={styles.tdRight}>{formatCurrency(asset.remainingCostBasis)}</td>
            ) : null}

            {visibleColumnSet.has("avgBuyPrice") ? (
                <td className={styles.tdRight}>{formatCurrency(asset.avgBuyPrice)}</td>
            ) : null}

            {visibleColumnSet.has("price") ? (
                <td className={styles.tdRight}>
                    {formatCurrency(asset.marketPrice ?? asset.latestTradePrice)}
                </td>
            ) : null}

            {visibleColumnSet.has("positionValue") ? (
                <td className={styles.tdRight}>{formatCurrency(asset.positionValue)}</td>
            ) : null}

            {visibleColumnSet.has("unrealizedPnL") ? (
                <td className={`${styles.tdRight} ${styles[pnlClass] ?? ""}`}>
                    {formatCurrency(asset.unrealizedPnL)}
                </td>
            ) : null}

            {visibleColumnSet.has("totalDividendNet") ? (
                <td className={styles.tdRight}>{formatCurrency(asset.totalDividendNet)}</td>
            ) : null}

            {visibleColumnSet.has("portfolios") ? <td>{renderPortfolioListSummary(asset)}</td> : null}
        </>
    );
}

function PortfolioValueCells({
    portfolio,
    asset,
    visibleColumnSet,
}: {
    portfolio: PortfolioPosition;
    asset: AssetSummary;
} & SharedRowProps) {
    const portfolioPnLClass = getPnLClass(portfolio.unrealizedPnL);

    return (
        <>
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
                    {formatCurrency(portfolio.marketPrice ?? portfolio.latestTradePrice)}
                </td>
            ) : null}

            {visibleColumnSet.has("positionValue") ? (
                <td className={`${styles.tdRight} ${styles.subtleValue}`}>
                    {formatCurrency(portfolio.positionValue)}
                </td>
            ) : null}

            {visibleColumnSet.has("unrealizedPnL") ? (
                <td
                    className={`${styles.tdRight} ${styles.subtleValue} ${
                        styles[portfolioPnLClass] ?? ""
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
                    <span className={styles.portfolioSubRowLabel}>Anteil am Asset</span>
                </td>
            ) : null}
        </>
    );
}

type AssetTableBodyProps = {
    assets: AssetSummary[];
    expandedIsins: Set<string>;
    onToggleExpanded: (isin: string) => void;
    onAuditAsset?: (asset: AssetSummary) => void;
} & SharedRowProps;

export function AssetTableBody({
    assets,
    visibleColumnSet,
    expandedIsins,
    onToggleExpanded,
    onAuditAsset,
}: AssetTableBodyProps) {
    return (
        <tbody>
            {assets.map((asset) => {
                const portfolioBreakdown = getSafePortfolioBreakdown(asset);
                const isExpanded = expandedIsins.has(asset.isin);
                const showPortfolioRows = isExpanded && portfolioBreakdown.length > 1;

                return (
                    <Fragment key={asset.isin}>
                        <tr className={styles.assetMainRow}>
                            <AssetValueCells asset={asset} visibleColumnSet={visibleColumnSet} />

                            <td className={styles.editCell}>
                                {onAuditAsset ? (
                                    <button
                                        type="button"
                                        className={styles.auditButton}
                                        onClick={() => onAuditAsset(asset)}
                                    >
                                        Bearbeiten
                                    </button>
                                ) : null}
                            </td>

                            <td className={styles.actionsCell}>
                                {portfolioBreakdown.length > 1 ? (
                                    <button
                                        type="button"
                                        className={styles.expandButton}
                                        onClick={() => onToggleExpanded(asset.isin)}
                                        aria-label={
                                            isExpanded
                                                ? "Portfolio-Details einklappen"
                                                : "Portfolio-Details aufklappen"
                                        }
                                        aria-expanded={isExpanded}
                                    >
                                        <span
                                            className={`${styles.expandChevron} ${
                                                isExpanded ? styles.expandChevronOpen : ""
                                            }`}
                                            aria-hidden="true"
                                        >
                                            ▾
                                        </span>
                                    </button>
                                ) : (
                                    <div className={styles.expandSpacer} aria-hidden="true" />
                                )}
                            </td>
                        </tr>

                        {showPortfolioRows
                            ? portfolioBreakdown.map((portfolio) => (
                                  <tr
                                      key={`${asset.isin}-${portfolio.portfolioId}`}
                                      className={styles.portfolioSubRow}
                                  >
                                      <PortfolioValueCells
                                          portfolio={portfolio}
                                          asset={asset}
                                          visibleColumnSet={visibleColumnSet}
                                      />
                                      <td className={styles.editCell} />
                                      <td className={styles.actionsCell} />
                                  </tr>
                              ))
                            : null}
                    </Fragment>
                );
            })}
        </tbody>
    );
}
