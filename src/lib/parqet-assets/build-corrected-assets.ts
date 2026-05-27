import type { GlobalAssetViewModel, PortfolioPosition } from "../types";
import type { NormalizedActivity } from "./normalization";
import {
    applyBuyPositionDelta,
    applySellLikePositionDelta,
    applyTransferInPositionDelta,
    calculatePositionMetrics,
    incrementTotalBoughtShares,
    incrementTotalSoldShares,
    normalizePositionRounding,
    sumDividendNet,
    updateLatestTradePrice,
} from "../calculations/global-asset-metrics";

type AssetAccumulator = {
    isin: string;

    portfolioIds: string[];
    portfolioNames: string[];
    portfolioBreakdown: PortfolioPosition[];

    activityCount: number;
    buyCount: number;
    sellCount: number;
    dividendCount: number;

    totalBoughtShares: number;
    totalSoldShares: number;
    netShares: number;

    totalInvestedGross: number;
    remainingCostBasis: number;
    avgBuyPrice: number | null;

    latestTradePrice: number | null;
    marketPrice: number | null;
    marketPriceAt: string | null;
    marketPriceSource: string | null;

    positionValue: number | null;
    unrealizedPnL: number | null;

    totalDividendNet: number;
    latestActivityAt: string | null;

    name?: string | null;
    assetName?: string | null;
    displayName?: string | null;
    title?: string | null;

    symbol?: string | null;
    ticker?: string | null;
    tickerSymbol?: string | null;

    wkn?: string | null;

    metadata?: null;
    externalMetadata?: null;
    assetMeta?: null;
};

function createEmptyPortfolioPosition(
    portfolioId: string,
    portfolioName: string
): PortfolioPosition {
    return {
        portfolioId,
        portfolioName,

        netShares: 0,
        remainingCostBasis: 0,
        avgBuyPrice: null,

        latestTradePrice: null,
        marketPrice: null,

        positionValue: null,
        unrealizedPnL: null,

        totalDividendNet: 0,
    };
}

function createEmptyAssetAccumulator(isin: string): AssetAccumulator {
    return {
        isin,

        portfolioIds: [],
        portfolioNames: [],
        portfolioBreakdown: [],

        activityCount: 0,
        buyCount: 0,
        sellCount: 0,
        dividendCount: 0,

        totalBoughtShares: 0,
        totalSoldShares: 0,
        netShares: 0,

        totalInvestedGross: 0,
        remainingCostBasis: 0,
        avgBuyPrice: null,

        latestTradePrice: null,
        marketPrice: null,
        marketPriceAt: null,
        marketPriceSource: null,

        positionValue: null,
        unrealizedPnL: null,

        totalDividendNet: 0,
        latestActivityAt: null,

        name: null,
        assetName: null,
        displayName: null,
        title: null,

        symbol: null,
        ticker: null,
        tickerSymbol: null,

        wkn: null,

        metadata: null,
        externalMetadata: null,
        assetMeta: null,
    };
}

function recalculatePortfolioPosition(position: PortfolioPosition): void {
    const metrics = calculatePositionMetrics({
        netShares: position.netShares,
        remainingCostBasis: position.remainingCostBasis,
        latestTradePrice: position.latestTradePrice,
        marketPrice: position.marketPrice,
    });

    position.avgBuyPrice = metrics.avgBuyPrice;
    position.positionValue = metrics.positionValue;
    position.unrealizedPnL = metrics.unrealizedPnL;
}

function recalculateAsset(acc: AssetAccumulator): void {
    const metrics = calculatePositionMetrics({
        netShares: acc.netShares,
        remainingCostBasis: acc.remainingCostBasis,
        latestTradePrice: acc.latestTradePrice,
        marketPrice: acc.marketPrice,
    });

    acc.avgBuyPrice = metrics.avgBuyPrice;
    acc.positionValue = metrics.positionValue;
    acc.unrealizedPnL = metrics.unrealizedPnL;
}

/**
 * Baut Assets aus der bereinigten Activity-Pipeline.
 *
 * Fachliche Entscheidungen:
 * - transfer_in behandelt Bestand wie Zugang, aber ohne neue Kostenbasis
 * - transfer_out behandelt Bestand wie Abgang und reduziert Kostenbasis proportional
 * - unknown beeinflusst keine Bestandslogik
 */
export function buildCorrectedAssets(
    activities: NormalizedActivity[],
    portfolioNameById: Map<string, string>
): GlobalAssetViewModel[] {
    const grouped = new Map<string, AssetAccumulator>();

    const sortedActivities = [...activities].sort((a, b) => {
        return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
    });

    for (const activity of sortedActivities) {
        if (!grouped.has(activity.isin)) {
            grouped.set(activity.isin, createEmptyAssetAccumulator(activity.isin));
        }

        const item = grouped.get(activity.isin);

        if (!item) {
            continue;
        }

        item.activityCount += 1;
        item.name ??= activity.name;
        item.symbol ??= activity.symbol;
        item.wkn ??= activity.wkn;

        const portfolioId = activity.portfolioId ?? "__unknown_portfolio__";
        const portfolioName =
            portfolioNameById.get(portfolioId) ??
            activity.portfolioId ??
            "Unbekanntes Portfolio";

        if (!item.portfolioIds.includes(portfolioId)) {
            item.portfolioIds.push(portfolioId);
        }

        if (!item.portfolioNames.includes(portfolioName)) {
            item.portfolioNames.push(portfolioName);
        }

        let portfolioEntry = item.portfolioBreakdown.find(
            (entry) => entry.portfolioId === portfolioId
        );

        if (!portfolioEntry) {
            portfolioEntry = createEmptyPortfolioPosition(portfolioId, portfolioName);
            item.portfolioBreakdown.push(portfolioEntry);
        }

        const shares = activity.shares;
        const amount = activity.amount;
        const amountNet = activity.amountNet;
        const price = activity.price;

        if (activity.type === "buy") {
            item.buyCount += 1;
            item.totalBoughtShares = incrementTotalBoughtShares(
                item.totalBoughtShares,
                shares
            );
            item.totalInvestedGross += amount;
            const assetNext = applyBuyPositionDelta(item, { shares, amount });
            item.netShares = assetNext.netShares;
            item.remainingCostBasis = assetNext.remainingCostBasis;

            const portfolioNext = applyBuyPositionDelta(portfolioEntry, {
                shares,
                amount,
            });
            portfolioEntry.netShares = portfolioNext.netShares;
            portfolioEntry.remainingCostBasis = portfolioNext.remainingCostBasis;

            item.latestTradePrice = updateLatestTradePrice(item.latestTradePrice, price);
            portfolioEntry.latestTradePrice = updateLatestTradePrice(
                portfolioEntry.latestTradePrice,
                price
            );
        }

        if (activity.type === "sell") {
            item.sellCount += 1;
            item.totalSoldShares = incrementTotalSoldShares(
                item.totalSoldShares,
                shares
            );

            const assetNext = applySellLikePositionDelta(item, { shares });
            item.netShares = assetNext.netShares;
            item.remainingCostBasis = assetNext.remainingCostBasis;

            const portfolioNext = applySellLikePositionDelta(portfolioEntry, {
                shares,
            });
            portfolioEntry.netShares = portfolioNext.netShares;
            portfolioEntry.remainingCostBasis = portfolioNext.remainingCostBasis;

            item.latestTradePrice = updateLatestTradePrice(item.latestTradePrice, price);
            portfolioEntry.latestTradePrice = updateLatestTradePrice(
                portfolioEntry.latestTradePrice,
                price
            );
        }

        if (activity.type === "transfer_in") {
            const assetNext = applyTransferInPositionDelta(item, { shares });
            item.netShares = assetNext.netShares;

            const portfolioNext = applyTransferInPositionDelta(portfolioEntry, {
                shares,
            });
            portfolioEntry.netShares = portfolioNext.netShares;

            item.latestTradePrice = updateLatestTradePrice(item.latestTradePrice, price);
            portfolioEntry.latestTradePrice = updateLatestTradePrice(
                portfolioEntry.latestTradePrice,
                price
            );
        }

        if (activity.type === "transfer_out") {
            const assetNext = applySellLikePositionDelta(item, { shares });
            item.netShares = assetNext.netShares;
            item.remainingCostBasis = assetNext.remainingCostBasis;

            const portfolioNext = applySellLikePositionDelta(portfolioEntry, {
                shares,
            });
            portfolioEntry.netShares = portfolioNext.netShares;
            portfolioEntry.remainingCostBasis = portfolioNext.remainingCostBasis;

            item.latestTradePrice = updateLatestTradePrice(item.latestTradePrice, price);
            portfolioEntry.latestTradePrice = updateLatestTradePrice(
                portfolioEntry.latestTradePrice,
                price
            );
        }

        if (activity.type === "dividend") {
            item.dividendCount += 1;
            item.totalDividendNet = sumDividendNet({
                currentTotalDividendNet: item.totalDividendNet,
                amount,
                amountNet,
            });
            portfolioEntry.totalDividendNet = sumDividendNet({
                currentTotalDividendNet: portfolioEntry.totalDividendNet,
                amount,
                amountNet,
            });
        }

        if (
            !item.latestActivityAt ||
            new Date(activity.datetime).getTime() >
            new Date(item.latestActivityAt).getTime()
        ) {
            item.latestActivityAt = activity.datetime;
        }

        const normalizedAssetPosition = normalizePositionRounding(
            {
                netShares: item.netShares,
                remainingCostBasis: item.remainingCostBasis,
            },
            { moneyTolerance: 0.01 }
        );
        item.netShares = normalizedAssetPosition.netShares;
        item.remainingCostBasis = normalizedAssetPosition.remainingCostBasis;

        const normalizedPortfolioPosition = normalizePositionRounding(
            {
                netShares: portfolioEntry.netShares,
                remainingCostBasis: portfolioEntry.remainingCostBasis,
            },
            { moneyTolerance: 0.01 }
        );
        portfolioEntry.netShares = normalizedPortfolioPosition.netShares;
        portfolioEntry.remainingCostBasis = normalizedPortfolioPosition.remainingCostBasis;

        recalculatePortfolioPosition(portfolioEntry);
        recalculateAsset(item);
    }

    return Array.from(grouped.values())
        .map((asset) => {
            const sortedPortfolioBreakdown = [...asset.portfolioBreakdown].sort((a, b) => {
                const aValue = a.positionValue ?? 0;
                const bValue = b.positionValue ?? 0;

                if (bValue !== aValue) {
                    return bValue - aValue;
                }

                return a.portfolioName.localeCompare(b.portfolioName, "de");
            });

            return {
                ...asset,
                portfolioBreakdown: sortedPortfolioBreakdown,
            };
        })
        .sort((a, b) => {
            const aValue = a.positionValue ?? 0;
            const bValue = b.positionValue ?? 0;

            if (bValue !== aValue) {
                return bValue - aValue;
            }

            const aTime = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : 0;
            const bTime = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : 0;

            return bTime - aTime;
        });
}
