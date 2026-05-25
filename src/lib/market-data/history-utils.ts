import type { DbMarketPricePoint } from "./db/types-core";

export const HISTORY_PERIODS = ["1M", "3M", "6M", "1Y", "3Y", "5Y", "MAX"] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

export const MAX_HISTORY_POINTS = 1200;

export function isHistoryPeriod(value: string): value is HistoryPeriod {
    return HISTORY_PERIODS.includes(value as HistoryPeriod);
}

export function isStrictIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function shiftLatestDate(latestPriceDate: string, months: number): string | null {
    const latest = new Date(`${latestPriceDate}T00:00:00.000Z`);
    if (Number.isNaN(latest.getTime())) {
        return null;
    }
    latest.setUTCMonth(latest.getUTCMonth() - months);
    return latest.toISOString().slice(0, 10);
}

export function resolveFromDateForPeriod(input: {
    requestedPeriod: HistoryPeriod;
    latestPriceDate: string | null;
}): string | null {
    const { requestedPeriod, latestPriceDate } = input;
    if (requestedPeriod === "MAX") {
        return null;
    }
    if (!latestPriceDate || !isStrictIsoDate(latestPriceDate)) {
        return null;
    }

    if (requestedPeriod === "1M") return shiftLatestDate(latestPriceDate, 1);
    if (requestedPeriod === "3M") return shiftLatestDate(latestPriceDate, 3);
    if (requestedPeriod === "6M") return shiftLatestDate(latestPriceDate, 6);
    if (requestedPeriod === "1Y") return shiftLatestDate(latestPriceDate, 12);
    if (requestedPeriod === "3Y") return shiftLatestDate(latestPriceDate, 36);
    return shiftLatestDate(latestPriceDate, 60);
}

export function downsampleHistoryPoints(points: DbMarketPricePoint[], maxPoints = MAX_HISTORY_POINTS): {
    points: DbMarketPricePoint[];
    pointCountRaw: number;
    pointCountReturned: number;
    downsampled: boolean;
} {
    const pointCountRaw = points.length;
    if (pointCountRaw <= maxPoints || pointCountRaw <= 2 || maxPoints < 3) {
        return {
            points,
            pointCountRaw,
            pointCountReturned: pointCountRaw,
            downsampled: false,
        };
    }

    const first = points[0];
    const last = points[points.length - 1];
    const interior = points.slice(1, -1);
    const interiorTarget = maxPoints - 2;
    const sampledInterior: DbMarketPricePoint[] = [];

    for (let i = 0; i < interiorTarget; i += 1) {
        const index = Math.floor((i * interior.length) / interiorTarget);
        sampledInterior.push(interior[index]);
    }

    return {
        points: [first, ...sampledInterior, last],
        pointCountRaw,
        pointCountReturned: sampledInterior.length + 2,
        downsampled: true,
    };
}
