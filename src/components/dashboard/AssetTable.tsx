"use client";

import { useState } from "react";
import {
    formatCurrency,
    formatShares,
    getAssetDisplayName,
    getAssetInitials,
    getAssetLogoUrl,
    getPnLClass,
} from "../../lib/format";
import type { AssetSummary } from "../../lib/types";

function AssetAvatar({ asset }: { asset: AssetSummary }) {
    const [imageError, setImageError] = useState(false);

    const displayName = getAssetDisplayName(asset);
    const initials = getAssetInitials(asset);
    const logoUrl = getAssetLogoUrl(asset);

    return (
        <div className="parqet-asset-avatar">
            {!imageError ? (
                <img
                    src={logoUrl}
                    alt={displayName}
                    className="parqet-asset-logo"
                    onError={() => setImageError(true)}
                />
            ) : (
                <span className="parqet-asset-avatar-fallback">{initials}</span>
            )}
        </div>
    );
}

type AssetTableProps = {
    assets: AssetSummary[];
};

export default function AssetTable({ assets }: AssetTableProps) {
    if (assets.length === 0) {
        return <div className="parqet-empty-state">Noch keine Assets geladen.</div>;
    }

    return (
        <table className="parqet-table parqet-assets-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Einstieg</th>
                    <th>Position</th>
                    <th>Kursgewinn</th>
                    <th>Dividenden</th>
                    <th>Portfolios</th>
                </tr>
            </thead>
            <tbody>
                {assets.map((asset) => {
                    const displayName = getAssetDisplayName(asset);

                    return (
                        <tr key={asset.isin}>
                            <td>
                                <div className="parqet-asset-name-cell">
                                    <AssetAvatar asset={asset} />

                                    <div>
                                        <div className="parqet-asset-title">{displayName}</div>
                                        <div className="parqet-asset-meta">ISIN: {asset.isin}</div>
                                        <div className="parqet-asset-meta">
                                            {asset.buyCount} Buy · {asset.sellCount} Sell ·{" "}
                                            {asset.activityCount} Events
                                        </div>
                                    </div>
                                </div>
                            </td>

                            <td>
                                <div className="parqet-metric-main">
                                    {formatCurrency(asset.remainingCostBasis)}
                                </div>
                                <div className="parqet-metric-sub">
                                    {formatCurrency(asset.avgBuyPrice)}
                                </div>
                            </td>

                            <td>
                                <div className="parqet-metric-main">
                                    {formatCurrency(asset.positionValue)}
                                </div>
                                <div className="parqet-metric-sub">
                                    {formatShares(asset.netShares)} x{" "}
                                    {formatCurrency(asset.latestTradePrice)}
                                </div>
                            </td>

                            <td>
                                <div
                                    className={`parqet-metric-main ${getPnLClass(
                                        asset.unrealizedPnL
                                    )}`}
                                >
                                    {formatCurrency(asset.unrealizedPnL)}
                                </div>
                            </td>

                            <td>
                                <div className="parqet-metric-main">
                                    {formatCurrency(asset.totalDividendNet)}
                                </div>
                                <div className="parqet-metric-sub">
                                    {asset.dividendCount} Dividende(n)
                                </div>
                            </td>

                            <td>
                                <div className="parqet-portfolio-badges">
                                    {asset.portfolioNames.map((portfolioName) => (
                                        <span
                                            key={`${asset.isin}-${portfolioName}`}
                                            className="parqet-portfolio-badge"
                                        >
                                            {portfolioName}
                                        </span>
                                    ))}
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}