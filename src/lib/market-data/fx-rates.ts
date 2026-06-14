import "server-only";

import { PostgresConfigError, queryPostgres } from "../db/postgres-core";
import { MarketDataRepositoryError } from "./db/repository";

export type UsdEurFxRateSnapshot = {
    fromCurrency: "USD";
    toCurrency: "EUR";
    rate: number;
    rateDate: string;
    provider: string | null;
    source: string | null;
};

export type UsdEurFxRatesByDate = Record<string, UsdEurFxRateSnapshot>;

function normalizeDate(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

function normalizeDbDateValue(value: unknown): string {
    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }

    const text = String(value);
    return normalizeDate(text.slice(0, 10)) ?? text;
}

function normalizeProvider(value: string | null | undefined): string | null {
    const trimmed = value?.trim().toLowerCase();
    return trimmed ? trimmed : null;
}

function mapFxRateRow(row: Record<string, unknown>): UsdEurFxRateSnapshot {
    return {
        fromCurrency: "USD",
        toCurrency: "EUR",
        rate: Number(row.rate),
        rateDate: normalizeDbDateValue(row.rate_date),
        provider: row.provider === null ? null : String(row.provider),
        source: row.source === null ? null : String(row.source),
    };
}

function handleFxRepositoryError(error: unknown): never {
    if (error instanceof MarketDataRepositoryError) {
        throw error;
    }
    if (error instanceof PostgresConfigError) {
        throw new MarketDataRepositoryError("missing_db_config", error.message);
    }
    throw new MarketDataRepositoryError(
        "db_error",
        "Marktdaten-DB Fehler in getUsdEurFxRatesByDates(fx_daily_rates).",
    );
}

export async function getUsdEurFxRatesByDates(input: {
    dates: string[];
    provider?: string | null;
}): Promise<UsdEurFxRatesByDate> {
    const dates = Array.from(
        new Set(input.dates.map((date) => normalizeDate(date)).filter((date): date is string => date !== null)),
    ).sort();

    if (dates.length === 0) {
        return {};
    }

    const provider = normalizeProvider(input.provider);

    try {
        const result = await queryPostgres<Record<string, unknown>>(
            `select distinct on (rate_date)
                provider,
                base_currency,
                quote_currency,
                rate_date,
                rate,
                source,
                updated_at
             from fx_daily_rates
             where upper(base_currency) = 'USD'
               and upper(quote_currency) = 'EUR'
               and rate_date = any($1::date[])
               and ($2::text is null or provider = $2)
             order by rate_date, updated_at desc`,
            [dates, provider],
        );

        const mapped: UsdEurFxRatesByDate = {};
        for (const row of result.rows) {
            const item = mapFxRateRow(row);
            if (Number.isFinite(item.rate) && item.rate > 0) {
                mapped[item.rateDate] = item;
            }
        }
        return mapped;
    } catch (error) {
        handleFxRepositoryError(error);
    }
}
