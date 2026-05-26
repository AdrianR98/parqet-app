import { promises as fs } from "fs";
import path from "path";
import type { MarketDataProvider, MarketSymbolOverride, MarketSymbolResolution } from "./types";

const ALLOWED_PROVIDERS: ReadonlySet<MarketDataProvider> = new Set(["yfinance"]);
const SYMBOL_OVERRIDES_PATH = path.join(process.cwd(), "src", "data", "market-symbol-overrides.json");

export function normalizeIsin(isin: string): string {
    return isin.replace(/\s+/g, "").toUpperCase();
}

function isValidProvider(value: unknown): value is MarketDataProvider {
    return typeof value === "string" && ALLOWED_PROVIDERS.has(value as MarketDataProvider);
}

function sanitizeOverride(raw: unknown): MarketSymbolOverride | null {
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const candidate = raw as Partial<MarketSymbolOverride>;
    const isin = typeof candidate.isin === "string" ? normalizeIsin(candidate.isin) : "";
    const symbol = typeof candidate.symbol === "string" ? candidate.symbol.trim().toUpperCase() : "";
    const provider = candidate.provider;

    if (!isin || !symbol || !isValidProvider(provider)) {
        return null;
    }

    return {
        isin,
        provider,
        symbol,
        name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : undefined,
    };
}

export async function loadMarketSymbolOverrides(): Promise<MarketSymbolOverride[]> {
    try {
        const raw = await fs.readFile(SYMBOL_OVERRIDES_PATH, "utf8");
        const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .map(sanitizeOverride)
            .filter((entry): entry is MarketSymbolOverride => entry != null);
    } catch {
        return [];
    }
}

export async function resolveMarketSymbolForIsin(isin: string): Promise<MarketSymbolResolution> {
    const normalizedIsin = normalizeIsin(isin);

    if (!/^[A-Z0-9]{12}$/.test(normalizedIsin)) {
        return {
            ok: false,
            isin: normalizedIsin,
            status: "invalid_request",
            message: "Ungültige ISIN.",
        };
    }

    const overrides = await loadMarketSymbolOverrides();
    const match = overrides.find((entry) => entry.isin === normalizedIsin);

    if (!match) {
        return {
            ok: false,
            isin: normalizedIsin,
            status: "missing_symbol",
            message: "Für dieses Asset ist noch kein Marktdaten-Symbol hinterlegt.",
        };
    }

    return {
        ok: true,
        isin: normalizedIsin,
        provider: match.provider,
        symbol: match.symbol,
        name: match.name,
    };
}
