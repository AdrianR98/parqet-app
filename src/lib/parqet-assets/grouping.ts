import type { AssetSummary } from "../types";
import type { Activity, AssetAccumulator } from "./activity-types";
import { getActivityAssetMeta, toNumber } from "./activity-utils";

// Gruppiert alle relevanten Activities nach ISIN und berechnet daraus
// die zentrale Asset-Sicht fuer das Dashboard.
export function groupActivitiesByIsin(
    activities: Activity[],
    portfolioNameById: Map<string, string>
): AssetSummary[] {
    const grouped = new Map<string, AssetAccumulator>();

    // Chronologisch sortieren, damit Buy/Sell-Reihenfolge fuer die
    // Kostenbasis konsistent verarbeitet wird.
    const sortedActivities = [...activities].sort((a, b) => {
        return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
    });

    for (const activity of sortedActivities) {
        const meta = getActivityAssetMeta(activity);
        const isin = meta.isin;

        if (!isin) {
            continue;
        }

        if (!grouped.has(isin)) {
            grouped.set(isin, {
                isin,
                name: meta.name,
                symbol: meta.symbol,
                wkn: meta.wkn,
                portfolioIds: [],
                portfolioNames: [],
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
            });
        }

        const item = grouped.get(isin);

        if (!item) {
            continue;
        }

        // Bereits bekannte Metadaten nur ergaenzen, nicht ueberschreiben.
        item.name ??= meta.name;
        item.symbol ??= meta.symbol;
        item.wkn ??= meta.wkn;

        item.activityCount += 1;

        if (activity.portfolioId && !item.portfolioIds.includes(activity.portfolioId)) {
            item.portfolioIds.push(activity.portfolioId);

            const portfolioName =
                portfolioNameById.get(activity.portfolioId) ?? activity.portfolioId;

            if (!item.portfolioNames.includes(portfolioName)) {
                item.portfolioNames.push(portfolioName);
            }
        }

        const shares = toNumber(activity.shares);
        const amount = toNumber(activity.amount);
        const amountNet = toNumber(activity.amountNet);
        const price = toNumber(activity.price);

        if (activity.type === "buy") {
            item.buyCount += 1;
            item.totalBoughtShares += shares;
            item.netShares += shares;
            item.totalInvestedGross += amount;
            item.remainingCostBasis += amount;

            if (price > 0) {
                item.latestTradePrice = price;
            }
        }

        if (activity.type === "sell") {
            item.sellCount += 1;
            item.totalSoldShares += shares;

            const currentAvgBuyPrice =
                item.netShares > 0 ? item.remainingCostBasis / item.netShares : 0;

            const removedCostBasis = currentAvgBuyPrice * shares;
            item.remainingCostBasis -= removedCostBasis;
            item.netShares -= shares;

            // Rundungsreste glattziehen
            if (item.netShares < 0 && Math.abs(item.netShares) < 0.0000001) {
                item.netShares = 0;
            }

            if (
                item.remainingCostBasis < 0 &&
                Math.abs(item.remainingCostBasis) < 0.0000001
            ) {
                item.remainingCostBasis = 0;
            }

            if (price > 0) {
                item.latestTradePrice = price;
            }
        }

        if (activity.type === "dividend") {
            item.dividendCount += 1;
            item.totalDividendNet += amountNet || amount;
        }

        if (
            !item.latestActivityAt ||
            new Date(activity.datetime).getTime() >
            new Date(item.latestActivityAt).getTime()
        ) {
            item.latestActivityAt = activity.datetime;
        }

        item.avgBuyPrice =
            item.netShares > 0 ? item.remainingCostBasis / item.netShares : null;

        const effectivePrice = item.marketPrice ?? item.latestTradePrice;

        item.positionValue =
            effectivePrice !== null ? item.netShares * effectivePrice : null;

        item.unrealizedPnL =
            item.positionValue !== null
                ? item.positionValue - item.remainingCostBasis
                : null;
    }

    return Array.from(grouped.values()).sort((a, b) => {
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