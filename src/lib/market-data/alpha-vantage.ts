import "server-only";

import { buildDiagnostics, classifyAlphaVantagePayload, parseDailySeries } from "./alpha-vantage-parser";
import type { ProviderFetchResult } from "./types";

const ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query";

export async function fetchAlphaVantageDailySeries(symbol: string): Promise<ProviderFetchResult> {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();

    if (!apiKey) {
        return {
            ok: false,
            status: "missing_api_key",
            message: "Alpha-Vantage-API-Key ist serverseitig nicht konfiguriert.",
            diagnostics: buildDiagnostics({
                symbol,
                providerStatusCategory: "missing_api_key",
                detectedResponseShape: "unexpected",
            }),
        };
    }

    const query = new URLSearchParams({
        function: "TIME_SERIES_DAILY",
        symbol,
        outputsize: "compact",
        apikey: apiKey,
    });

    try {
        const response = await fetch(`${ALPHA_VANTAGE_BASE_URL}?${query.toString()}`, {
            method: "GET",
            cache: "no-store",
        });

        if (!response.ok) {
            return {
                ok: false,
                status: "provider_error",
                message: "Kursdaten konnten nicht geladen werden.",
                diagnostics: buildDiagnostics({
                    symbol,
                    providerStatusCategory: "provider_error",
                    detectedResponseShape: "unexpected",
                }),
            };
        }

        const payload = await response.json() as Record<string, unknown>;
        const providerFailure = classifyAlphaVantagePayload(payload, symbol);

        if (providerFailure) {
            return providerFailure;
        }

        const parsed = parseDailySeries(payload);

        if (parsed.points.length === 0) {
            return {
                ok: false,
                status: "provider_error",
                message: "Kursdaten konnten nicht geladen werden.",
                diagnostics: buildDiagnostics({
                    symbol,
                    providerStatusCategory: "provider_error",
                    detectedResponseShape: parsed.shape,
                    pointCount: 0,
                }),
            };
        }

        return {
            ok: true,
            points: parsed.points,
            source: "alphavantage:TIME_SERIES_DAILY:compact",
            refreshedAt: new Date().toISOString(),
            diagnostics: buildDiagnostics({
                symbol,
                providerStatusCategory: "ok",
                detectedResponseShape: parsed.shape,
                pointCount: parsed.points.length,
            }),
        };
    } catch {
        return {
            ok: false,
            status: "provider_error",
            message: "Kursdaten konnten nicht geladen werden.",
            diagnostics: buildDiagnostics({
                symbol,
                providerStatusCategory: "provider_error",
                detectedResponseShape: "unexpected",
            }),
        };
    }
}
