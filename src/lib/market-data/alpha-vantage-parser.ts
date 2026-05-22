import type { MarketDataDiagnostics, MarketDataPoint, MarketDataResponseShape, ProviderFetchResult } from "./types";

function toFiniteNumber(value: unknown): number | null {
    if (typeof value !== "string" && typeof value !== "number") {
        return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function isMarketDataPoint(point: MarketDataPoint | null): point is MarketDataPoint {
    return point !== null;
}

export function detectSeriesShape(payload: Record<string, unknown>): MarketDataResponseShape {
    if (payload["Time Series (Daily Adjusted)"] && typeof payload["Time Series (Daily Adjusted)"] === "object") {
        return "daily_adjusted";
    }

    if (payload["Time Series (Daily)"] && typeof payload["Time Series (Daily)"] === "object") {
        return "daily";
    }

    if (typeof payload.Note === "string") {
        return "note";
    }

    if (typeof payload.Information === "string") {
        return "information";
    }

    if (typeof payload["Error Message"] === "string") {
        return "error_message";
    }

    return "unexpected";
}

export function parseDailySeries(payload: Record<string, unknown>): { points: MarketDataPoint[]; shape: MarketDataResponseShape } {
    const shape = detectSeriesShape(payload);
    const dailyRaw = payload["Time Series (Daily Adjusted)"] ?? payload["Time Series (Daily)"];

    if (!dailyRaw || typeof dailyRaw !== "object") {
        return { points: [], shape };
    }

    const parsedPoints: Array<MarketDataPoint | null> = Object.entries(dailyRaw as Record<string, unknown>)
        .map(([date, values]) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !values || typeof values !== "object") {
                return null;
            }

            const row = values as Record<string, unknown>;
            const close = toFiniteNumber(row["4. close"]);

            if (close === null) {
                return null;
            }

            return {
                date,
                close,
                open: toFiniteNumber(row["1. open"]) ?? undefined,
                high: toFiniteNumber(row["2. high"]) ?? undefined,
                low: toFiniteNumber(row["3. low"]) ?? undefined,
                volume: toFiniteNumber(row["6. volume"] ?? row["5. volume"]),
            };
        });

    return {
        points: parsedPoints.filter(isMarketDataPoint).sort((left, right) => left.date.localeCompare(right.date)),
        shape,
    };
}

export function buildDiagnostics(input: {
    symbol: string;
    providerStatusCategory: MarketDataDiagnostics["providerStatusCategory"];
    detectedResponseShape: MarketDataResponseShape;
    pointCount?: number;
}): MarketDataDiagnostics {
    return {
        provider: "alphavantage",
        symbol: input.symbol,
        providerStatusCategory: input.providerStatusCategory,
        detectedResponseShape: input.detectedResponseShape,
        pointCount: input.pointCount,
    };
}

export function classifyAlphaVantagePayload(payload: Record<string, unknown>, symbol: string): ProviderFetchResult | null {
    const note = typeof payload.Note === "string" ? payload.Note : "";
    const info = typeof payload.Information === "string" ? payload.Information : "";
    const errorMessage = typeof payload["Error Message"] === "string" ? payload["Error Message"] : "";
    const shape = detectSeriesShape(payload);

    const lowerNote = note.toLowerCase();
    const lowerInfo = info.toLowerCase();
    const lowerError = errorMessage.toLowerCase();

    if (lowerNote.includes("call frequency") || lowerNote.includes("limit") || lowerInfo.includes("call frequency") || lowerInfo.includes("limit")) {
        return {
            ok: false,
            status: "rate_limited",
            message: "Alpha-Vantage-Tageslimit erreicht. Es wurden keine neuen Kursdaten abgefragt.",
            diagnostics: buildDiagnostics({
                symbol,
                providerStatusCategory: "rate_limited",
                detectedResponseShape: shape,
            }),
        };
    }

    if (lowerInfo.includes("invalid api key") || lowerInfo.includes("api key") || lowerInfo.includes("premium")) {
        return {
            ok: false,
            status: "provider_error",
            message: "Kursdaten konnten nicht geladen werden.",
            diagnostics: buildDiagnostics({
                symbol,
                providerStatusCategory: "provider_error",
                detectedResponseShape: shape,
            }),
        };
    }

    if (lowerError.includes("invalid api call") || lowerError.includes("invalid symbol") || lowerError.includes("symbol")) {
        return {
            ok: false,
            status: "not_found",
            message: "Kursdaten konnten nicht geladen werden.",
            diagnostics: buildDiagnostics({
                symbol,
                providerStatusCategory: "not_found",
                detectedResponseShape: shape,
            }),
        };
    }

    if (errorMessage) {
        return {
            ok: false,
            status: "provider_error",
            message: "Kursdaten konnten nicht geladen werden.",
            diagnostics: buildDiagnostics({
                symbol,
                providerStatusCategory: "provider_error",
                detectedResponseShape: shape,
            }),
        };
    }

    return null;
}
