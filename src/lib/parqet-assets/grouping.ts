// src/lib/grouping.ts

import type { GlobalAssetViewModel, PortfolioPosition } from "../types";
import type { Activity, AssetAccumulator } from "./activity-types";
import { getActivityAssetMeta, toNumber } from "./activity-utils";
import {
    applyBuyPositionDelta,
    applySellLikePositionDelta,
    calculatePositionMetrics,
    incrementTotalBoughtShares,
    incrementTotalSoldShares,
    normalizePositionRounding,
    sumDividendNet,
    updateLatestTradePrice,
} from "../calculations/global-asset-metrics";

// Gruppiert alle relevanten Activities nach ISIN und berechnet daraus
// die zentrale Asset-Sicht fuer das Dashboard.
//
// Neu:
// Zusaetzlich wird jetzt auch ein Breakdown pro Portfolio aufgebaut,
// damit spaeter eine Parqet-aehnliche Unterzeilenansicht moeglich ist.
export function groupActivitiesByIsin(
    activities: Activity[],
    portfolioNameById: Map<string, string>
): GlobalAssetViewModel[] {
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

        /**
         * Die Connect-Daten koennen portfolioId theoretisch optional liefern.
         * Fuer den Breakdown brauchen wir jedoch immer einen stabilen String-Key.
         *
         * Deshalb:
         * - echte portfolioId verwenden, wenn vorhanden
         * - sonst auf einen festen technischen Fallback gehen
         */
        const portfolioId = activity.portfolioId ?? "__unknown_portfolio__";
        const portfolioName =
            portfolioNameById.get(portfolioId) ??
            activity.portfolioId ??
            "Unbekanntes Portfolio";

        if (!item.portfolioIds.includes(portfolioId)) {
            item.portfolioIds.push(portfolioId);

            if (!item.portfolioNames.includes(portfolioName)) {
                item.portfolioNames.push(portfolioName);
            }
        }

        const shares = toNumber(activity.shares);
        const amount = toNumber(activity.amount);
        const amountNet = toNumber(activity.amountNet);
        const price = toNumber(activity.price);

        // Pro Asset zusaetzlich auch die Zahlen je Portfolio sammeln.
        // Das ist die Basis fuer spaetere Unterzeilen wie bei Parqet.
        let portfolioEntry = item.portfolioBreakdown.find(
            (p) => p.portfolioId === portfolioId
        );

        if (!portfolioEntry) {
            const newEntry: PortfolioPosition = {
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

            item.portfolioBreakdown.push(newEntry);
            portfolioEntry = newEntry;
        }

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
            item.remainingCostBasis = assetNext.remainingCostBasis;
            item.netShares = assetNext.netShares;

            const portfolioNext = applySellLikePositionDelta(portfolioEntry, {
                shares,
            });
            portfolioEntry.remainingCostBasis = portfolioNext.remainingCostBasis;
            portfolioEntry.netShares = portfolioNext.netShares;

            // Rundungsreste glattziehen
            const normalizedAssetPosition = normalizePositionRounding(
                {
                    netShares: item.netShares,
                    remainingCostBasis: item.remainingCostBasis,
                },
                { moneyTolerance: 0.0000001 }
            );
            item.netShares = normalizedAssetPosition.netShares;
            item.remainingCostBasis = normalizedAssetPosition.remainingCostBasis;

            const normalizedPortfolioPosition = normalizePositionRounding(
                {
                    netShares: portfolioEntry.netShares,
                    remainingCostBasis: portfolioEntry.remainingCostBasis,
                },
                { moneyTolerance: 0.0000001 }
            );
            portfolioEntry.netShares = normalizedPortfolioPosition.netShares;
            portfolioEntry.remainingCostBasis =
                normalizedPortfolioPosition.remainingCostBasis;

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

        // Gesamtwerte fuer das Asset neu berechnen
        const assetMetrics = calculatePositionMetrics({
            netShares: item.netShares,
            remainingCostBasis: item.remainingCostBasis,
            latestTradePrice: item.latestTradePrice,
            marketPrice: item.marketPrice,
        });
        item.avgBuyPrice = assetMetrics.avgBuyPrice;
        item.positionValue = assetMetrics.positionValue;
        item.unrealizedPnL = assetMetrics.unrealizedPnL;

        // Werte fuer das einzelne Portfolio neu berechnen
        const portfolioMetrics = calculatePositionMetrics({
            netShares: portfolioEntry.netShares,
            remainingCostBasis: portfolioEntry.remainingCostBasis,
            latestTradePrice: portfolioEntry.latestTradePrice,
            marketPrice: portfolioEntry.marketPrice,
        });
        portfolioEntry.avgBuyPrice = portfolioMetrics.avgBuyPrice;
        portfolioEntry.positionValue = portfolioMetrics.positionValue;
        portfolioEntry.unrealizedPnL = portfolioMetrics.unrealizedPnL;
    }

    return Array.from(grouped.values())
        .map((asset) => {
            // Breakdown fuer spaetere UI konsistent sortieren:
            // groesster Positionswert zuerst, dann Name.
            const sortedPortfolioBreakdown = [...asset.portfolioBreakdown].sort(
                (a, b) => {
                    const aValue = a.positionValue ?? 0;
                    const bValue = b.positionValue ?? 0;

                    if (bValue !== aValue) {
                        return bValue - aValue;
                    }

                    return a.portfolioName.localeCompare(b.portfolioName, "de");
                }
            );

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
