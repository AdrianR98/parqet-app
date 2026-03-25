import { getAssetDisplayName } from "../../lib/asset-display";
import type { AssetSummary, PortfolioPosition } from "../../lib/types";

export type SortKey =
    | "name"
    | "netShares"
    | "remainingCostBasis"
    | "avgBuyPrice"
    | "price"
    | "positionValue"
    | "unrealizedPnL"
    | "totalDividendNet"
    | "portfolioCount";

export type SortDirection = "asc" | "desc";

export type ColumnKey =
    | "asset"
    | "netShares"
    | "remainingCostBasis"
    | "avgBuyPrice"
    | "price"
    | "positionValue"
    | "unrealizedPnL"
    | "totalDividendNet"
    | "portfolios";

export type ColumnConfig = {
    key: ColumnKey;
    label: string;
    sortKey?: SortKey;
    align?: "left" | "right";
    isFixed?: boolean;
    width: number;
};

export const ALL_COLUMNS: ColumnConfig[] = [
    { key: "asset", label: "NAME", sortKey: "name", align: "left", isFixed: true, width: 360 },
    { key: "netShares", label: "ANTEILE", sortKey: "netShares", align: "right", width: 120 },
    {
        key: "remainingCostBasis",
        label: "EINSTIEG\nPREIS",
        sortKey: "remainingCostBasis",
        align: "right",
        width: 128,
    },
    { key: "avgBuyPrice", label: "Ø KAUF", sortKey: "avgBuyPrice", align: "right", width: 110 },
    { key: "price", label: "POSITION\nKURS", sortKey: "price", align: "right", width: 128 },
    {
        key: "positionValue",
        label: "POSITIONSWERT",
        sortKey: "positionValue",
        align: "right",
        isFixed: true,
        width: 140,
    },
    {
        key: "unrealizedPnL",
        label: "KURSGEWINN",
        sortKey: "unrealizedPnL",
        align: "right",
        width: 122,
    },
    {
        key: "totalDividendNet",
        label: "DIVIDENDEN",
        sortKey: "totalDividendNet",
        align: "right",
        width: 110,
    },
    {
        key: "portfolios",
        label: "PORTFOLIOS",
        sortKey: "portfolioCount",
        align: "left",
        width: 150,
    },
];

export const FIXED_COLUMNS: ColumnKey[] = ["asset", "positionValue"];

export const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
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

export const EDIT_ACTION_WIDTH = 124;
export const EXPAND_ACTION_WIDTH = 52;

export function getSafePortfolioBreakdown(asset: AssetSummary): PortfolioPosition[] {
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
        portfolioName: portfolioNames[index] ?? portfolioIds[index] ?? `Portfolio ${index + 1}`,
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

export function compareNullableNumbers(
    a: number | null | undefined,
    b: number | null | undefined
) {
    const left = a ?? Number.NEGATIVE_INFINITY;
    const right = b ?? Number.NEGATIVE_INFINITY;

    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

export function getSortValue(
    asset: AssetSummary,
    sortKey: SortKey
): string | number | null {
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
