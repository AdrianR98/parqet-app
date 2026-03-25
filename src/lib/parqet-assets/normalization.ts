import type { Activity } from "./activity-types";
import { getActivityAssetMeta, toNumber } from "./activity-utils";

export type NormalizedActivityType =
    | "buy"
    | "sell"
    | "dividend"
    | "transfer_in"
    | "transfer_out"
    | "unknown";

export type NormalizedActivity = {
    id: string;
    isin: string;
    portfolioId: string | null;
    datetime: string;

    type: NormalizedActivityType;
    rawType: string;

    shares: number;
    price: number;
    amount: number;
    amountNet: number;

    name: string | null;
    symbol: string | null;
    wkn: string | null;
};

function mapActivityType(type: string): NormalizedActivityType {
    switch (type) {
        case "buy":
            return "buy";
        case "sell":
            return "sell";
        case "dividend":
            return "dividend";

        // vorbereitet für spätere Spezialfälle / manuelle Korrekturen
        case "transfer_in":
        case "inbound_delivery":
            return "transfer_in";

        case "transfer_out":
        case "outbound_delivery":
            return "transfer_out";

        default:
            return "unknown";
    }
}

export function normalizeActivities(activities: Activity[]): NormalizedActivity[] {
    return activities
        .map((activity) => {
            const meta = getActivityAssetMeta(activity);

            if (!meta.isin) {
                return null;
            }

            return {
                id: activity.id,
                isin: meta.isin,
                portfolioId: activity.portfolioId ?? null,
                datetime: activity.datetime,

                type: mapActivityType(activity.type),
                rawType: activity.type,

                shares: toNumber(activity.shares),
                price: toNumber(activity.price),
                amount: toNumber(activity.amount),
                amountNet: toNumber(activity.amountNet),

                name: meta.name,
                symbol: meta.symbol,
                wkn: meta.wkn,
            };
        })
        .filter((entry): entry is NormalizedActivity => entry !== null);
}