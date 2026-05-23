
import { PostgresConfigError, queryPostgres, withPostgresClient } from "../../db/postgres-core";
import type {
    AddMarketDataRunItemInput,
    CreateMarketDataRunInput,
    DbMarketAction,
    DbMarketInstrument,
    DbMarketPricePoint,
    DbMarketSymbolMapping,
    FinishMarketDataRunInput,
    GetDailyPricesInput,
    ListMarketInstrumentsInput,
    GetMarketActionsInput,
    ListUnverifiedSymbolMappingsInput,
    ListIsinsWithVerifiedMappingsInput,
    DbMarketSymbolMappingCandidate,
    MarketDataStatusSummary,
    VerifiedMappingForPromotion,
    PrimaryMappingForBackfill,
    UpdateSymbolMappingValidationInput,
    UpsertDailyPricesInput,
    UpsertInstrumentInput,
    UpsertMarketActionsInput,
    UpsertSymbolMappingInput,
} from "./types-core";

export class MarketDataRepositoryError extends Error {
    readonly code: "missing_db_config" | "invalid_input" | "db_error";

    constructor(code: "missing_db_config" | "invalid_input" | "db_error", message: string) {
        super(message);
        this.name = "MarketDataRepositoryError";
        this.code = code;
    }
}

function normalizeIsin(isin: string): string {
    return isin.replace(/\s+/g, "").toUpperCase();
}

function assertIsin(isin: string): string {
    const normalized = normalizeIsin(isin);
    if (!/^[A-Z0-9]{12}$/.test(normalized)) {
        throw new MarketDataRepositoryError("invalid_input", "Ungültige ISIN.");
    }

    return normalized;
}

function toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function toDateString(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new MarketDataRepositoryError("invalid_input", "Ungültiges Datum.");
    }
    return date.toISOString().slice(0, 10);
}

function mapInstrumentRow(row: Record<string, unknown>): DbMarketInstrument {
    return {
        id: String(row.id),
        isin: String(row.isin),
        name: row.name === null ? null : String(row.name),
        assetType: row.asset_type === null ? null : String(row.asset_type),
        currency: row.currency === null ? null : String(row.currency),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}

function mapSymbolMappingRow(row: Record<string, unknown>): DbMarketSymbolMapping {
    return {
        id: String(row.id),
        instrumentId: String(row.instrument_id),
        provider: String(row.provider),
        symbol: String(row.symbol),
        exchange: row.exchange === null ? null : String(row.exchange),
        currency: row.currency === null ? null : String(row.currency),
        isPrimary: Boolean(row.is_primary),
        isActive: Boolean(row.is_active),
        verifiedAt: row.verified_at === null ? null : String(row.verified_at),
        notes: row.notes === null ? null : String(row.notes),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}

function mapSymbolMappingCandidateRow(row: Record<string, unknown>): DbMarketSymbolMappingCandidate {
    return {
        isin: String(row.isin),
        name: row.name === null ? null : String(row.name),
        provider: String(row.provider),
        symbol: String(row.symbol),
        exchange: row.exchange === null ? null : String(row.exchange),
        currency: row.currency === null ? null : String(row.currency),
        isPrimary: Boolean(row.is_primary),
        isActive: Boolean(row.is_active),
        verifiedAt: row.verified_at === null ? null : String(row.verified_at),
        notes: row.notes === null ? null : String(row.notes),
    };
}

function mapPriceRow(row: Record<string, unknown>): DbMarketPricePoint {
    return {
        provider: String(row.provider),
        symbol: String(row.symbol),
        date: String(row.date),
        open: toNullableNumber(row.open),
        high: toNullableNumber(row.high),
        low: toNullableNumber(row.low),
        close: Number(row.close),
        adjClose: toNullableNumber(row.adj_close),
        volume: toNullableNumber(row.volume),
        currency: row.currency === null ? null : String(row.currency),
        source: row.source === null ? null : String(row.source),
        importedAt: String(row.imported_at),
    };
}

function mapActionRow(row: Record<string, unknown>): DbMarketAction {
    return {
        actionType: String(row.action_type),
        date: String(row.date),
        amount: toNullableNumber(row.amount),
        ratio: row.ratio === null ? null : String(row.ratio),
        currency: row.currency === null ? null : String(row.currency),
        source: row.source === null ? null : String(row.source),
        importedAt: String(row.imported_at),
    };
}

function handleRepositoryError(error: unknown): never {
    if (error instanceof MarketDataRepositoryError) {
        throw error;
    }
    if (error instanceof PostgresConfigError) {
        throw new MarketDataRepositoryError("missing_db_config", error.message);
    }
    throw new MarketDataRepositoryError("db_error", "Marktdaten-DB ist derzeit nicht verfügbar.");
}

export async function getInstrumentByIsin(isin: string): Promise<DbMarketInstrument | null> {
    try {
        const normalizedIsin = assertIsin(isin);
        const result = await queryPostgres<Record<string, unknown>>(
            `select id, isin, name, asset_type, currency, created_at, updated_at
             from market_instruments
             where isin = $1
             limit 1`,
            [normalizedIsin],
        );
        const row = result.rows[0];
        return row ? mapInstrumentRow(row) : null;
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function upsertInstrument(input: UpsertInstrumentInput): Promise<DbMarketInstrument> {
    try {
        const normalizedIsin = assertIsin(input.isin);
        const result = await queryPostgres<Record<string, unknown>>(
            `insert into market_instruments (isin, name, asset_type, currency)
             values ($1, $2, $3, $4)
             on conflict (isin)
             do update set
               name = excluded.name,
               asset_type = excluded.asset_type,
               currency = excluded.currency,
               updated_at = now()
             returning id, isin, name, asset_type, currency, created_at, updated_at`,
            [normalizedIsin, input.name ?? null, input.assetType ?? null, input.currency ?? null],
        );
        return mapInstrumentRow(result.rows[0]);
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listMarketInstruments(input: ListMarketInstrumentsInput = {}): Promise<DbMarketInstrument[]> {
    try {
        const limit = Number.isFinite(input.limit) && (input.limit ?? 0) > 0 ? Math.floor(input.limit as number) : 5000;
        const result = await queryPostgres<Record<string, unknown>>(
            `select id, isin, name, asset_type, currency, created_at, updated_at
             from market_instruments
             order by isin asc
             limit $1`,
            [limit],
        );
        return result.rows.map((row) => mapInstrumentRow(row));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function getPrimarySymbolMappingByIsin(isin: string, provider?: string): Promise<DbMarketSymbolMapping | null> {
    try {
        const normalizedIsin = assertIsin(isin);
        const result = await queryPostgres<Record<string, unknown>>(
            `select m.id, m.instrument_id, m.provider, m.symbol, m.exchange, m.currency, m.is_primary, m.is_active,
                    m.verified_at, m.notes, m.created_at, m.updated_at
             from market_symbol_mappings m
             join market_instruments i on i.id = m.instrument_id
             where i.isin = $1
               and ($2::text is null or m.provider = $2)
               and m.is_active = true
             order by m.is_primary desc, m.updated_at desc
             limit 1`,
            [normalizedIsin, provider ?? null],
        );
        const row = result.rows[0];
        return row ? mapSymbolMappingRow(row) : null;
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function getSymbolMappingsByIsin(isin: string, provider?: string): Promise<DbMarketSymbolMapping[]> {
    try {
        const normalizedIsin = assertIsin(isin);
        const normalizedProvider = provider?.trim() ? provider.trim().toLowerCase() : null;
        const result = await queryPostgres<Record<string, unknown>>(
            `select m.id, m.instrument_id, m.provider, m.symbol, m.exchange, m.currency, m.is_primary, m.is_active,
                    m.verified_at, m.notes, m.created_at, m.updated_at
             from market_symbol_mappings m
             join market_instruments i on i.id = m.instrument_id
             where i.isin = $1
               and ($2::text is null or m.provider = $2)
             order by m.is_primary desc, m.updated_at desc, m.symbol asc`,
            [normalizedIsin, normalizedProvider],
        );
        return result.rows.map((row) => mapSymbolMappingRow(row));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function getSymbolMappingByProviderSymbol(provider: string, symbol: string): Promise<DbMarketSymbolMapping | null> {
    try {
        const normalizedProvider = provider.trim().toLowerCase();
        const normalizedSymbol = symbol.trim().toUpperCase();
        if (!normalizedProvider || !normalizedSymbol) {
            throw new MarketDataRepositoryError("invalid_input", "Provider oder Symbol fehlt.");
        }

        const result = await queryPostgres<Record<string, unknown>>(
            `select id, instrument_id, provider, symbol, exchange, currency, is_primary, is_active,
                    verified_at, notes, created_at, updated_at
             from market_symbol_mappings
             where provider = $1
               and symbol = $2
             limit 1`,
            [normalizedProvider, normalizedSymbol],
        );
        const row = result.rows[0];
        return row ? mapSymbolMappingRow(row) : null;
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listUnverifiedSymbolMappings(
    input: ListUnverifiedSymbolMappingsInput = {},
): Promise<DbMarketSymbolMappingCandidate[]> {
    try {
        const normalizedProvider = input.provider?.trim() ? input.provider.trim().toLowerCase() : null;
        const normalizedIsin = input.isin ? assertIsin(input.isin) : null;
        const limit = Number.isFinite(input.limit) && (input.limit ?? 0) > 0 ? Math.floor(input.limit as number) : 100;

        const result = await queryPostgres<Record<string, unknown>>(
            `select i.isin, i.name, m.provider, m.symbol, m.exchange, m.currency, m.is_primary, m.is_active, m.verified_at, m.notes
             from market_symbol_mappings m
             join market_instruments i on i.id = m.instrument_id
             where m.verified_at is null
               and ($1::text is null or m.provider = $1)
               and ($2::text is null or i.isin = $2)
             order by i.isin asc, m.updated_at desc, m.symbol asc
             limit $3`,
            [normalizedProvider, normalizedIsin, limit],
        );
        return result.rows.map((row) => mapSymbolMappingCandidateRow(row));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listIsinsWithVerifiedMappings(input: ListIsinsWithVerifiedMappingsInput = {}): Promise<string[]> {
    try {
        const normalizedProvider = input.provider?.trim() ? input.provider.trim().toLowerCase() : null;
        const result = await queryPostgres<{ isin: string }>(
            `select distinct i.isin
             from market_symbol_mappings m
             join market_instruments i on i.id = m.instrument_id
             where m.verified_at is not null
               and ($1::text is null or m.provider = $1)
             order by i.isin asc`,
            [normalizedProvider],
        );
        return result.rows.map((row) => String(row.isin));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function getMarketDataStatusSummary(): Promise<MarketDataStatusSummary> {
    try {
        const result = await queryPostgres<Record<string, unknown>>(
            `with
                instruments_total as (select count(*)::int as value from market_instruments),
                mappings_total as (select count(*)::int as value from market_symbol_mappings),
                yfinance_mappings_total as (select count(*)::int as value from market_symbol_mappings where provider = 'yfinance'),
                verified_yfinance_mappings as (select count(*)::int as value from market_symbol_mappings where provider = 'yfinance' and verified_at is not null),
                primary_yfinance_mappings as (select count(*)::int as value from market_symbol_mappings where provider = 'yfinance' and is_primary = true),
                instruments_with_verified_yfinance as (
                    select count(distinct i.id)::int as value
                    from market_instruments i
                    join market_symbol_mappings m on m.instrument_id = i.id
                    where m.provider = 'yfinance' and m.verified_at is not null
                ),
                instruments_without_any_mapping as (
                    select count(*)::int as value
                    from market_instruments i
                    left join market_symbol_mappings m on m.instrument_id = i.id
                    where m.instrument_id is null
                ),
                instruments_with_mapping_but_no_verified_yfinance as (
                    select count(*)::int as value
                    from market_instruments i
                    where exists (select 1 from market_symbol_mappings m where m.instrument_id = i.id)
                      and not exists (
                          select 1
                          from market_symbol_mappings y
                          where y.instrument_id = i.id and y.provider = 'yfinance' and y.verified_at is not null
                      )
                ),
                instruments_with_primary_yfinance as (
                    select count(distinct i.id)::int as value
                    from market_instruments i
                    join market_symbol_mappings m on m.instrument_id = i.id
                    where m.provider = 'yfinance' and m.is_primary = true
                ),
                instruments_without_primary_yfinance as (
                    select count(*)::int as value
                    from market_instruments i
                    where not exists (
                        select 1
                        from market_symbol_mappings m
                        where m.instrument_id = i.id and m.provider = 'yfinance' and m.is_primary = true
                    )
                ),
                instruments_with_daily_prices as (
                    select count(distinct instrument_id)::int as value from market_prices_daily
                ),
                instruments_with_actions as (
                    select count(distinct instrument_id)::int as value from market_actions
                ),
                instruments_with_primary_but_no_prices as (
                    select count(*)::int as value
                    from market_instruments i
                    where exists (
                        select 1
                        from market_symbol_mappings m
                        where m.instrument_id = i.id and m.provider = 'yfinance' and m.is_primary = true
                    )
                      and not exists (
                        select 1
                        from market_prices_daily p
                        where p.instrument_id = i.id
                    )
                ),
                failed_validation_candidates as (
                    select count(*)::int as value
                    from market_symbol_mappings
                    where provider = 'yfinance'
                      and notes ilike '%validated:yfinance; status=failed%'
                )
             select
                (select value from instruments_total) as instruments_total,
                (select value from mappings_total) as mappings_total,
                (select value from yfinance_mappings_total) as yfinance_mappings_total,
                (select value from verified_yfinance_mappings) as verified_yfinance_mappings,
                (select value from primary_yfinance_mappings) as primary_yfinance_mappings,
                (select value from instruments_with_verified_yfinance) as instruments_with_verified_yfinance,
                (select value from instruments_without_any_mapping) as instruments_without_any_mapping,
                (select value from instruments_with_mapping_but_no_verified_yfinance) as instruments_with_mapping_but_no_verified_yfinance,
                (select value from instruments_with_primary_yfinance) as instruments_with_primary_yfinance,
                (select value from instruments_without_primary_yfinance) as instruments_without_primary_yfinance,
                (select value from instruments_with_daily_prices) as instruments_with_daily_prices,
                (select value from instruments_with_actions) as instruments_with_actions,
                (select value from instruments_with_primary_but_no_prices) as instruments_with_primary_but_no_prices,
                (select value from failed_validation_candidates) as failed_validation_candidates`,
        );

        const row = result.rows[0];
        return {
            instrumentsTotal: Number(row.instruments_total ?? 0),
            mappingsTotal: Number(row.mappings_total ?? 0),
            yfinanceMappingsTotal: Number(row.yfinance_mappings_total ?? 0),
            verifiedYfinanceMappings: Number(row.verified_yfinance_mappings ?? 0),
            primaryYfinanceMappings: Number(row.primary_yfinance_mappings ?? 0),
            instrumentsWithVerifiedYfinance: Number(row.instruments_with_verified_yfinance ?? 0),
            instrumentsWithoutAnyMapping: Number(row.instruments_without_any_mapping ?? 0),
            instrumentsWithMappingButNoVerifiedYfinance: Number(row.instruments_with_mapping_but_no_verified_yfinance ?? 0),
            instrumentsWithPrimaryYfinance: Number(row.instruments_with_primary_yfinance ?? 0),
            instrumentsWithoutPrimaryYfinance: Number(row.instruments_without_primary_yfinance ?? 0),
            instrumentsWithDailyPrices: Number(row.instruments_with_daily_prices ?? 0),
            instrumentsWithActions: Number(row.instruments_with_actions ?? 0),
            instrumentsWithPrimaryButNoPrices: Number(row.instruments_with_primary_but_no_prices ?? 0),
            failedValidationCandidates: Number(row.failed_validation_candidates ?? 0),
        };
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listVerifiedMappingsForPromotion(provider = "yfinance", isin?: string): Promise<VerifiedMappingForPromotion[]> {
    try {
        const normalizedProvider = provider.trim().toLowerCase();
        const normalizedIsin = isin ? assertIsin(isin) : null;
        const result = await queryPostgres<Record<string, unknown>>(
            `select i.isin, i.name, m.provider, m.symbol, m.exchange, m.currency, m.is_primary, m.is_active, m.verified_at, m.notes
             from market_symbol_mappings m
             join market_instruments i on i.id = m.instrument_id
             where m.provider = $1
               and m.verified_at is not null
               and m.is_active = true
               and ($2::text is null or i.isin = $2)
             order by i.isin asc, m.symbol asc`,
            [normalizedProvider, normalizedIsin],
        );

        return result.rows.map((row) => ({
            isin: String(row.isin),
            name: row.name === null ? null : String(row.name),
            provider: String(row.provider),
            symbol: String(row.symbol),
            exchange: row.exchange === null ? null : String(row.exchange),
            currency: row.currency === null ? null : String(row.currency),
            isPrimary: Boolean(row.is_primary),
            isActive: Boolean(row.is_active),
            verifiedAt: String(row.verified_at),
            notes: row.notes === null ? null : String(row.notes),
        }));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function setPrimarySymbolMappingByIsin(
    isin: string,
    provider: string,
    symbol: string,
    noteSuffix?: string,
): Promise<void> {
    try {
        const normalizedIsin = assertIsin(isin);
        const normalizedProvider = provider.trim().toLowerCase();
        const normalizedSymbol = symbol.trim().toUpperCase();
        if (!normalizedProvider || !normalizedSymbol) {
            throw new MarketDataRepositoryError("invalid_input", "Provider oder Symbol fehlt.");
        }

        await withPostgresClient(async (client) => {
            await client.query("begin");
            try {
                await client.query(
                    `update market_symbol_mappings m
                     set is_primary = false,
                         updated_at = now()
                     from market_instruments i
                     where m.instrument_id = i.id
                       and i.isin = $1
                       and m.provider = $2`,
                    [normalizedIsin, normalizedProvider],
                );

                await client.query(
                    `update market_symbol_mappings m
                     set is_primary = true,
                         notes = case
                             when $4::text is null then m.notes
                             when m.notes is null then $4::text
                             else left(m.notes || ' | ' || $4::text, 2000)
                         end,
                         updated_at = now()
                     from market_instruments i
                     where m.instrument_id = i.id
                       and i.isin = $1
                       and m.provider = $2
                       and m.symbol = $3`,
                    [normalizedIsin, normalizedProvider, normalizedSymbol, noteSuffix ?? null],
                );

                await client.query("commit");
            } catch (error) {
                await client.query("rollback");
                throw error;
            }
        });
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listPrimaryMappingsForBackfill(provider = "yfinance", isin?: string): Promise<PrimaryMappingForBackfill[]> {
    try {
        const normalizedProvider = provider.trim().toLowerCase();
        const normalizedIsin = isin ? assertIsin(isin) : null;
        const result = await queryPostgres<Record<string, unknown>>(
            `select
                i.isin,
                i.name,
                m.provider,
                m.symbol,
                m.exchange,
                m.currency,
                exists (
                    select 1 from market_prices_daily p
                    where p.instrument_id = i.id
                ) as has_prices,
                exists (
                    select 1 from market_actions a
                    where a.instrument_id = i.id
                ) as has_actions,
                m.verified_at
             from market_symbol_mappings m
             join market_instruments i on i.id = m.instrument_id
             where m.provider = $1
               and m.is_primary = true
               and m.is_active = true
               and m.verified_at is not null
               and ($2::text is null or i.isin = $2)
             order by i.isin asc`,
            [normalizedProvider, normalizedIsin],
        );

        return result.rows.map((row) => ({
            isin: String(row.isin),
            name: row.name === null ? null : String(row.name),
            provider: String(row.provider),
            symbol: String(row.symbol),
            exchange: row.exchange === null ? null : String(row.exchange),
            currency: row.currency === null ? null : String(row.currency),
            hasPrices: Boolean(row.has_prices),
            hasActions: Boolean(row.has_actions),
            verifiedAt: String(row.verified_at),
        }));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function upsertSymbolMapping(input: UpsertSymbolMappingInput): Promise<DbMarketSymbolMapping> {
    try {
        const instrument = await upsertInstrument({ isin: input.isin });
        const provider = input.provider.trim();
        const symbol = input.symbol.trim().toUpperCase();
        if (!provider || !symbol) {
            throw new MarketDataRepositoryError("invalid_input", "Provider oder Symbol fehlt.");
        }

        const result = await queryPostgres<Record<string, unknown>>(
            `insert into market_symbol_mappings
                (instrument_id, provider, symbol, exchange, currency, is_primary, is_active, verified_at, notes)
             values
                ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             on conflict (provider, symbol)
             do update set
                instrument_id = excluded.instrument_id,
                exchange = excluded.exchange,
                currency = excluded.currency,
                is_primary = excluded.is_primary,
                is_active = excluded.is_active,
                verified_at = excluded.verified_at,
                notes = excluded.notes,
                updated_at = now()
             returning id, instrument_id, provider, symbol, exchange, currency, is_primary, is_active,
                       verified_at, notes, created_at, updated_at`,
            [
                instrument.id,
                provider,
                symbol,
                input.exchange ?? null,
                input.currency ?? null,
                input.isPrimary ?? false,
                input.isActive ?? true,
                input.verifiedAt ?? null,
                input.notes ?? null,
            ],
        );

        return mapSymbolMappingRow(result.rows[0]);
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function updateSymbolMappingValidation(input: UpdateSymbolMappingValidationInput): Promise<void> {
    try {
        const provider = input.provider.trim().toLowerCase();
        const symbol = input.symbol.trim().toUpperCase();
        if (!provider || !symbol) {
            throw new MarketDataRepositoryError("invalid_input", "Provider oder Symbol fehlt.");
        }

        await queryPostgres(
            `update market_symbol_mappings
             set verified_at = $3,
                 notes = $4,
                 is_active = coalesce($5, is_active),
                 updated_at = now()
             where provider = $1
               and symbol = $2`,
            [provider, symbol, input.verifiedAt ?? null, input.notes ?? null, input.isActive ?? null],
        );
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function getDailyPricesByIsin(input: GetDailyPricesInput): Promise<DbMarketPricePoint[]> {
    try {
        const normalizedIsin = assertIsin(input.isin);
        const result = await queryPostgres<Record<string, unknown>>(
            `select p.provider, p.symbol, p.date, p.open, p.high, p.low, p.close, p.adj_close, p.volume, p.currency, p.source, p.imported_at
             from market_prices_daily p
             join market_instruments i on i.id = p.instrument_id
             where i.isin = $1
               and ($2::text is null or p.provider = $2)
               and ($3::date is null or p.date >= $3::date)
               and ($4::date is null or p.date <= $4::date)
             order by p.date asc`,
            [normalizedIsin, input.provider ?? null, input.from ?? null, input.to ?? null],
        );
        return result.rows.map((row) => mapPriceRow(row));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function upsertDailyPrices(input: UpsertDailyPricesInput): Promise<{ upserted: number }> {
    try {
        if (input.points.length === 0) {
            return { upserted: 0 };
        }

        const instrument = await upsertInstrument({ isin: input.isin, currency: input.currency ?? null });
        const provider = input.provider.trim();
        const symbol = input.symbol.trim().toUpperCase();
        if (!provider || !symbol) {
            throw new MarketDataRepositoryError("invalid_input", "Provider oder Symbol fehlt.");
        }

        await withPostgresClient(async (client) => {
            await client.query("begin");
            try {
                for (const point of input.points) {
                    const close = Number(point.close);
                    if (!Number.isFinite(close)) {
                        continue;
                    }
                    await client.query(
                        `insert into market_prices_daily
                            (instrument_id, provider, symbol, date, open, high, low, close, adj_close, volume, currency, source)
                         values
                            ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12)
                         on conflict (instrument_id, provider, date)
                         do update set
                            symbol = excluded.symbol,
                            open = excluded.open,
                            high = excluded.high,
                            low = excluded.low,
                            close = excluded.close,
                            adj_close = excluded.adj_close,
                            volume = excluded.volume,
                            currency = excluded.currency,
                            source = excluded.source,
                            imported_at = now()`,
                        [
                            instrument.id,
                            provider,
                            symbol,
                            toDateString(point.date),
                            toNullableNumber(point.open),
                            toNullableNumber(point.high),
                            toNullableNumber(point.low),
                            close,
                            toNullableNumber(point.adjClose),
                            toNullableNumber(point.volume),
                            point.currency ?? input.currency ?? null,
                            input.source ?? null,
                        ],
                    );
                }
                await client.query("commit");
            } catch (error) {
                await client.query("rollback");
                throw error;
            }
        });

        return { upserted: input.points.length };
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function getMarketActionsByIsin(input: GetMarketActionsInput): Promise<DbMarketAction[]> {
    try {
        const normalizedIsin = assertIsin(input.isin);
        const result = await queryPostgres<Record<string, unknown>>(
            `select a.action_type, a.date, a.amount, a.ratio, a.currency, a.source, a.imported_at
             from market_actions a
             join market_instruments i on i.id = a.instrument_id
             where i.isin = $1
               and ($2::text is null or a.provider = $2)
               and ($3::date is null or a.date >= $3::date)
               and ($4::date is null or a.date <= $4::date)
             order by a.date asc`,
            [normalizedIsin, input.provider ?? null, input.from ?? null, input.to ?? null],
        );
        return result.rows.map((row) => mapActionRow(row));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function upsertMarketActions(input: UpsertMarketActionsInput): Promise<{ upserted: number }> {
    try {
        if (input.actions.length === 0) {
            return { upserted: 0 };
        }

        const instrument = await upsertInstrument({ isin: input.isin });
        const provider = input.provider.trim();
        const symbol = input.symbol.trim().toUpperCase();
        if (!provider || !symbol) {
            throw new MarketDataRepositoryError("invalid_input", "Provider oder Symbol fehlt.");
        }

        await withPostgresClient(async (client) => {
            await client.query("begin");
            try {
                for (const action of input.actions) {
                    const actionType = action.actionType.trim().toLowerCase();
                    if (!actionType) {
                        continue;
                    }
                    await client.query(
                        `insert into market_actions
                            (instrument_id, provider, symbol, action_type, date, amount, ratio, currency, source)
                         values
                            ($1, $2, $3, $4, $5::date, $6, $7, $8, $9)
                         on conflict (instrument_id, provider, action_type, date)
                         do update set
                            symbol = excluded.symbol,
                            amount = excluded.amount,
                            ratio = excluded.ratio,
                            currency = excluded.currency,
                            source = excluded.source,
                            imported_at = now()`,
                        [
                            instrument.id,
                            provider,
                            symbol,
                            actionType,
                            toDateString(action.date),
                            toNullableNumber(action.amount),
                            action.ratio ?? null,
                            action.currency ?? null,
                            input.source ?? null,
                        ],
                    );
                }
                await client.query("commit");
            } catch (error) {
                await client.query("rollback");
                throw error;
            }
        });

        return { upserted: input.actions.length };
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function createMarketDataRun(input: CreateMarketDataRunInput): Promise<{ runId: string }> {
    try {
        const result = await queryPostgres<{ id: string }>(
            `insert into market_data_runs (provider, run_type, status, requested_symbols)
             values ($1, $2, 'running', $3)
             returning id`,
            [input.provider.trim(), input.runType.trim(), input.requestedSymbols],
        );
        return { runId: result.rows[0].id };
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function finishMarketDataRun(input: FinishMarketDataRunInput): Promise<void> {
    try {
        await queryPostgres(
            `update market_data_runs
             set status = $2,
                 finished_at = now(),
                 successful_symbols = $3,
                 failed_symbols = $4,
                 error_message = $5
             where id = $1`,
            [
                input.runId,
                input.status.trim(),
                input.successfulSymbols,
                input.failedSymbols,
                input.errorMessage ?? null,
            ],
        );
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function addMarketDataRunItem(input: AddMarketDataRunItemInput): Promise<{ itemId: string }> {
    try {
        const result = await queryPostgres<{ id: string }>(
            `insert into market_data_run_items
                (run_id, instrument_id, provider, symbol, status, points_imported, actions_imported, first_date, last_date, error_message)
             values
                ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10)
             returning id`,
            [
                input.runId,
                input.instrumentId ?? null,
                input.provider.trim(),
                input.symbol.trim().toUpperCase(),
                input.status.trim(),
                input.pointsImported ?? 0,
                input.actionsImported ?? 0,
                input.firstDate ?? null,
                input.lastDate ?? null,
                input.errorMessage ?? null,
            ],
        );
        return { itemId: result.rows[0].id };
    } catch (error) {
        handleRepositoryError(error);
    }
}
