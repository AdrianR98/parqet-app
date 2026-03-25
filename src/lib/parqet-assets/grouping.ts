// src/lib/grouping.ts

import type { AssetSummary, PortfolioPosition } from "../types";
import type { Activity, AssetAccumulator } from "./activity-types";
import { getActivityAssetMeta, toNumber } from "./activity-utils";

// Gruppiert alle relevanten Activities nach ISIN und berechnet daraus
// die zentrale Asset-Sicht fuer das Dashboard.
//
// Neu:
// Zusaetzlich wird jetzt auch ein Breakdown pro Portfolio aufgebaut,
// damit spaeter eine Parqet-aehnliche Unterzeilenansicht moeglich ist.
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
            item.totalBoughtShares += shares;
            item.netShares += shares;
            item.totalInvestedGross += amount;
            item.remainingCostBasis += amount;

            portfolioEntry.netShares += shares;
            portfolioEntry.remainingCostBasis += amount;

            if (price > 0) {
                item.latestTradePrice = price;
                portfolioEntry.latestTradePrice = price;
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

            const portfolioAvgBuyPrice =
                portfolioEntry.netShares > 0
                    ? portfolioEntry.remainingCostBasis / portfolioEntry.netShares
                    : 0;

            const removedPortfolioCostBasis = portfolioAvgBuyPrice * shares;
            portfolioEntry.remainingCostBasis -= removedPortfolioCostBasis;
            portfolioEntry.netShares -= shares;

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

            if (
                portfolioEntry.netShares < 0 &&
                Math.abs(portfolioEntry.netShares) < 0.0000001
            ) {
                portfolioEntry.netShares = 0;
            }

            if (
                portfolioEntry.remainingCostBasis < 0 &&
                Math.abs(portfolioEntry.remainingCostBasis) < 0.0000001
            ) {
                portfolioEntry.remainingCostBasis = 0;
            }

            if (price > 0) {
                item.latestTradePrice = price;
                portfolioEntry.latestTradePrice = price;
            }
        }

        if (activity.type === "dividend") {
            item.dividendCount += 1;
            item.totalDividendNet += amountNet || amount;
            portfolioEntry.totalDividendNet += amountNet || amount;
        }

        if (
            !item.latestActivityAt ||
            new Date(activity.datetime).getTime() >
            new Date(item.latestActivityAt).getTime()
        ) {
            item.latestActivityAt = activity.datetime;
        }

        // Gesamtwerte fuer das Asset neu berechnen
        item.avgBuyPrice =
            item.netShares > 0 ? item.remainingCostBasis / item.netShares : null;

        const effectivePrice = item.marketPrice ?? item.latestTradePrice;

        item.positionValue =
            effectivePrice !== null ? item.netShares * effectivePrice : null;

        item.unrealizedPnL =
            item.positionValue !== null
                ? item.positionValue - item.remainingCostBasis
                : null;

        // Werte fuer das einzelne Portfolio neu berechnen
        portfolioEntry.avgBuyPrice =
            portfolioEntry.netShares > 0
                ? portfolioEntry.remainingCostBasis / portfolioEntry.netShares
                : null;

        const effectivePortfolioPrice =
            portfolioEntry.marketPrice ?? portfolioEntry.latestTradePrice;

        portfolioEntry.positionValue =
            effectivePortfolioPrice !== null
                ? portfolioEntry.netShares * effectivePortfolioPrice
                : null;

        portfolioEntry.unrealizedPnL =
            portfolioEntry.positionValue !== null
                ? portfolioEntry.positionValue - portfolioEntry.remainingCostBasis
                : null;
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