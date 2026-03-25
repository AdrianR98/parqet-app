import type { Activity } from "./activity-types";

// Diese Funktion wandelt unbekannte Zahlenwerte sicher in number um.
export function toNumber(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.replace(",", ".");
        const parsed = Number(normalized);

        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return 0;
}

// Liefert den ersten sinnvollen String zurueck.
// Das verhindert Probleme mit undefined, null oder Leerstrings.
export function pickFirstString(...values: unknown[]): string | null {
    for (const value of values) {
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim();
        }
    }

    return null;
}

// Extrahiert Asset-Metadaten aus einer Activity.
// Hintergrund:
// Parqet liefert die eigentlichen Bewegungsdaten stabiler als die Anzeige-Metadaten.
// Deshalb pruefen wir mehrere moegliche Feldquellen in Prioritaetsreihenfolge.
export function getActivityAssetMeta(activity: Activity) {
    const assetAny = activity.asset as Record<string, unknown> | undefined;
    const securityAny = activity.security as Record<string, unknown> | undefined;
    const activityAny = activity as Record<string, unknown>;

    return {
        isin: pickFirstString(
            activity.asset?.isin,
            activity.security?.isin,
            activity.isin,
            assetAny?.["assetIsin"],
            securityAny?.["assetIsin"],
            activityAny?.["assetIsin"]
        ),

        name: pickFirstString(
            activity.asset?.name,
            activity.asset?.displayName,
            activity.security?.name,
            activity.security?.displayName,
            activity.holdingName,
            activity.name,
            activity.displayName,

            // weitere haeufige Kandidaten
            activity.asset?.shortName,
            activity.asset?.longName,
            activity.asset?.companyName,
            activity.asset?.instrumentName,

            activity.security?.shortName,
            activity.security?.longName,
            activity.security?.companyName,
            activity.security?.instrumentName,

            assetAny?.["shortName"],
            assetAny?.["longName"],
            assetAny?.["companyName"],
            assetAny?.["instrumentName"],

            securityAny?.["shortName"],
            securityAny?.["longName"],
            securityAny?.["companyName"],
            securityAny?.["instrumentName"],

            activityAny?.["shortName"],
            activityAny?.["longName"],
            activityAny?.["companyName"],
            activityAny?.["instrumentName"]
        ),

        symbol: pickFirstString(
            activity.asset?.symbol,
            activity.asset?.ticker,
            activity.security?.symbol,
            activity.security?.ticker,
            activity.symbol,
            activity.ticker,

            assetAny?.["stockSymbol"],
            securityAny?.["stockSymbol"],
            activityAny?.["stockSymbol"]
        ),

        wkn: pickFirstString(
            activity.asset?.wkn,
            activity.security?.wkn,
            activity.wkn,
            assetAny?.["securityWkn"],
            securityAny?.["securityWkn"],
            activityAny?.["securityWkn"]
        ),
    };
}