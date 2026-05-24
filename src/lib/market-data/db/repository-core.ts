
import { PostgresConfigError, queryPostgres, withPostgresClient } from "../../db/postgres-core";
import type {
    AddMarketDataRunItemInput,
    CreateMarketDataRunInput,
    DbMarketAction,
    DbMarketInstrument,
    DbMarketInstrumentMetadata,
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
    EnrichMarketInstrumentsFromReferencesInput,
    EnrichMarketInstrumentsFromReferencesResult,
    DbMarketReferenceInstrument,
    DbMarketReferenceSource,
    DbXetraReferenceCandidate,
    InsertSymbolMappingCandidateInput,
    ListXetraReferenceCandidatesInput,
    UpsertReferenceInstrumentInput,
    UpsertReferenceSourceInput,
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
        displayName: row.display_name === null ? null : String(row.display_name),
        assetType: row.asset_type === null ? null : String(row.asset_type),
        currency: row.currency === null ? null : String(row.currency),
        wkn: row.wkn === null ? null : String(row.wkn),
        metadataSource: row.metadata_source === null ? null : String(row.metadata_source),
        metadataUpdatedAt: row.metadata_updated_at === null ? null : String(row.metadata_updated_at),
        nameSource: row.name_source === null ? null : String(row.name_source),
        displayNameSource: row.display_name_source === null ? null : String(row.display_name_source),
        displayMetadataUpdatedAt: row.display_metadata_updated_at === null ? null : String(row.display_metadata_updated_at),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}

function mapReferenceSourceRow(row: Record<string, unknown>): DbMarketReferenceSource {
    return {
        id: String(row.id),
        sourceKey: String(row.source_key),
        displayName: String(row.display_name),
        sourceType: String(row.source_type),
        fileName: row.file_name === null ? null : String(row.file_name),
        rowCount: row.row_count === null ? null : Number(row.row_count),
        importedAt: String(row.imported_at),
        notes: row.notes === null ? null : String(row.notes),
    };
}

function mapReferenceInstrumentRow(row: Record<string, unknown>): DbMarketReferenceInstrument {
    return {
        id: String(row.id),
        sourceKey: String(row.source_key),
        isin: row.isin === null ? null : String(row.isin),
        wkn: row.wkn === null ? null : String(row.wkn),
        name: row.name === null ? null : String(row.name),
        symbol: row.symbol === null ? null : String(row.symbol),
        mnemonic: row.mnemonic === null ? null : String(row.mnemonic),
        exchange: row.exchange === null ? null : String(row.exchange),
        micCode: row.mic_code === null ? null : String(row.mic_code),
        primaryMarketMicCode: row.primary_market_mic_code === null ? null : String(row.primary_market_mic_code),
        currency: row.currency === null ? null : String(row.currency),
        instrumentType: row.instrument_type === null ? null : String(row.instrument_type),
        productCategory: row.product_category === null ? null : String(row.product_category),
        marketSegment: row.market_segment === null ? null : String(row.market_segment),
        rawPayload: row.raw_payload && typeof row.raw_payload === "object" ? (row.raw_payload as Record<string, unknown>) : null,
        importedAt: String(row.imported_at),
    };
}

function mapXetraReferenceCandidateRow(row: Record<string, unknown>): DbXetraReferenceCandidate {
    return {
        instrumentId: String(row.instrument_id),
        isin: String(row.isin),
        name: row.name === null ? null : String(row.name),
        candidateSymbol: String(row.candidate_symbol),
        mnemonic: String(row.mnemonic),
        currency: row.currency === null ? null : String(row.currency),
        instrumentType: row.instrument_type === null ? null : String(row.instrument_type),
        marketSegment: row.market_segment === null ? null : String(row.market_segment),
        micCode: row.mic_code === null ? null : String(row.mic_code),
        primaryMarketMicCode: row.primary_market_mic_code === null ? null : String(row.primary_market_mic_code),
        hasVerifiedPrimary: Boolean(row.has_verified_primary),
        hasVerifiedYfinance: Boolean(row.has_verified_yfinance),
        hasAnyPrimary: Boolean(row.has_any_primary),
        hasExistingCandidate: Boolean(row.has_existing_candidate),
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
            `select id, isin, name, display_name, asset_type, currency, wkn, metadata_source, metadata_updated_at,
                    name_source, display_name_source, display_metadata_updated_at, created_at, updated_at
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
            `insert into market_instruments
                (isin, name, display_name, asset_type, currency, wkn, metadata_source, metadata_updated_at, name_source, display_name_source, display_metadata_updated_at)
             values
                ($1, $2, $3, $4, $5, $6, $7, case when $7::text is null then null else now() end, $8, $9, case when $9::text is null then null else now() end)
             on conflict (isin)
             do update set
               name = excluded.name,
               display_name = excluded.display_name,
               asset_type = excluded.asset_type,
               currency = excluded.currency,
               wkn = excluded.wkn,
               metadata_source = excluded.metadata_source,
               metadata_updated_at = case when excluded.metadata_source is null then market_instruments.metadata_updated_at else now() end,
               name_source = excluded.name_source,
               display_name_source = excluded.display_name_source,
               display_metadata_updated_at = case when excluded.display_name_source is null then market_instruments.display_metadata_updated_at else now() end,
               updated_at = now()
             returning id, isin, name, display_name, asset_type, currency, wkn, metadata_source, metadata_updated_at,
                       name_source, display_name_source, display_metadata_updated_at, created_at, updated_at`,
            [
                normalizedIsin,
                input.name ?? null,
                input.displayName ?? null,
                input.assetType ?? null,
                input.currency ?? null,
                input.wkn ?? null,
                input.metadataSource ?? null,
                input.nameSource ?? null,
                input.displayNameSource ?? null,
            ],
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
            `select id, isin, name, display_name, asset_type, currency, wkn, metadata_source, metadata_updated_at,
                    name_source, display_name_source, display_metadata_updated_at, created_at, updated_at
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

function normalizeMeaningfulInstrumentName(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    if (!normalized) return null;
    const lowered = normalized.toLowerCase();
    if (lowered === "unknown" || lowered === "n/a" || lowered === "undefined" || lowered === "null") {
        return null;
    }
    return normalized;
}

export function isMeaningfulInstrumentName(value: string | null | undefined, isin: string): boolean {
    const normalized = normalizeMeaningfulInstrumentName(value);
    if (!normalized) return false;
    return normalized.toUpperCase() !== isin.trim().toUpperCase();
}

export function chooseCuratedDisplayName(
    dbMetadata: Pick<DbMarketInstrumentMetadata, "displayName" | "name" | "isin">,
    existingName: string | null | undefined,
): string | null {
    if (isMeaningfulInstrumentName(dbMetadata.displayName, dbMetadata.isin)) {
        return normalizeMeaningfulInstrumentName(dbMetadata.displayName);
    }
    if (isMeaningfulInstrumentName(dbMetadata.name, dbMetadata.isin)) {
        return normalizeMeaningfulInstrumentName(dbMetadata.name);
    }
    if (isMeaningfulInstrumentName(existingName, dbMetadata.isin)) {
        return normalizeMeaningfulInstrumentName(existingName);
    }
    return null;
}

export async function getMarketInstrumentMetadataByIsins(isins: string[]): Promise<Record<string, DbMarketInstrumentMetadata>> {
    try {
        const normalizedIsins = Array.from(
            new Set(
                isins
                    .map((isin) => {
                        try {
                            return assertIsin(isin);
                        } catch {
                            return null;
                        }
                    })
                    .filter((isin): isin is string => Boolean(isin)),
            ),
        );

        if (normalizedIsins.length === 0) {
            return {};
        }

        const result = await queryPostgres<Record<string, unknown>>(
            `select i.isin, i.name, i.display_name, i.wkn, i.asset_type, i.currency, i.metadata_source, i.metadata_updated_at,
                    i.name_source, i.display_name_source, i.display_metadata_updated_at
             from market_instruments i
             where i.isin = any($1::text[])`,
            [normalizedIsins],
        );

        const metadataByIsin: Record<string, DbMarketInstrumentMetadata> = {};
        for (const row of result.rows) {
            const isin = String(row.isin);
            metadataByIsin[isin] = {
                isin,
                name: row.name === null ? null : String(row.name),
                displayName: row.display_name === null ? null : String(row.display_name),
                wkn: row.wkn === null ? null : String(row.wkn),
                assetType: row.asset_type === null ? null : String(row.asset_type),
                currency: row.currency === null ? null : String(row.currency),
                metadataSource: row.metadata_source === null ? null : String(row.metadata_source),
                metadataUpdatedAt: row.metadata_updated_at === null ? null : String(row.metadata_updated_at),
                nameSource: row.name_source === null ? null : String(row.name_source),
                displayNameSource: row.display_name_source === null ? null : String(row.display_name_source),
                displayMetadataUpdatedAt: row.display_metadata_updated_at === null ? null : String(row.display_metadata_updated_at),
            };
        }

        return metadataByIsin;
    } catch (error) {
        handleRepositoryError(error);
    }
}

function normalizeOptionalUpper(value?: string | null): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toUpperCase();
    return normalized || null;
}

function normalizeSourceKey(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
        throw new MarketDataRepositoryError("invalid_input", "source_key fehlt.");
    }
    return normalized;
}

function toAssetTypeHint(referenceType: string | null): string | null {
    const normalized = referenceType?.trim().toLowerCase() ?? "";
    if (!normalized) return null;
    if (normalized.includes("etf")) return "etf";
    if (normalized.includes("fund")) return "fund";
    if (normalized.includes("bond")) return "bond";
    if (normalized.includes("note")) return "bond";
    if (normalized.includes("share") || normalized.includes("stock") || normalized.includes("equity")) return "stock";
    return null;
}

function isAssetTypeWeak(assetType: string | null): boolean {
    if (!assetType) return true;
    const normalized = assetType.trim().toLowerCase();
    return !normalized || normalized === "unknown" || normalized === "other" || normalized === "n/a";
}

function isNameWeak(name: string | null, isin: string): boolean {
    if (!name) return true;
    const normalized = name.trim();
    return !normalized || normalized.toUpperCase() === isin.toUpperCase();
}

export async function upsertReferenceSource(input: UpsertReferenceSourceInput): Promise<DbMarketReferenceSource> {
    try {
        const sourceKey = normalizeSourceKey(input.sourceKey);
        const result = await queryPostgres<Record<string, unknown>>(
            `insert into market_reference_sources (source_key, display_name, source_type, file_name, row_count, imported_at, notes)
             values ($1, $2, $3, $4, $5, now(), $6)
             on conflict (source_key)
             do update set
               display_name = excluded.display_name,
               source_type = excluded.source_type,
               file_name = excluded.file_name,
               row_count = excluded.row_count,
               notes = excluded.notes,
               imported_at = now()
             returning id, source_key, display_name, source_type, file_name, row_count, imported_at, notes`,
            [sourceKey, input.displayName.trim(), input.sourceType.trim(), input.fileName ?? null, input.rowCount ?? null, input.notes ?? null],
        );
        return mapReferenceSourceRow(result.rows[0]);
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function upsertReferenceInstrument(input: UpsertReferenceInstrumentInput): Promise<DbMarketReferenceInstrument> {
    try {
        const sourceKey = normalizeSourceKey(input.sourceKey);
        const isin = input.isin ? assertIsin(input.isin) : null;
        const symbol = normalizeOptionalUpper(input.symbol);
        const mnemonic = normalizeOptionalUpper(input.mnemonic);
        const result = await queryPostgres<Record<string, unknown>>(
            `insert into market_reference_instruments
                (source_key, isin, wkn, name, symbol, mnemonic, exchange, mic_code, primary_market_mic_code, currency, instrument_type, product_category, market_segment, raw_payload, imported_at)
             values
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, now())
             on conflict (source_key, isin, coalesce(symbol, ''), coalesce(mnemonic, ''))
             do update set
                wkn = excluded.wkn,
                name = excluded.name,
                exchange = excluded.exchange,
                mic_code = excluded.mic_code,
                primary_market_mic_code = excluded.primary_market_mic_code,
                currency = excluded.currency,
                instrument_type = excluded.instrument_type,
                product_category = excluded.product_category,
                market_segment = excluded.market_segment,
                raw_payload = excluded.raw_payload,
                imported_at = now()
             returning id, source_key, isin, wkn, name, symbol, mnemonic, exchange, mic_code, primary_market_mic_code, currency, instrument_type, product_category, market_segment, raw_payload, imported_at`,
            [
                sourceKey,
                isin,
                normalizeOptionalUpper(input.wkn),
                input.name?.trim() || null,
                symbol,
                mnemonic,
                input.exchange?.trim() || null,
                input.micCode?.trim() || null,
                input.primaryMarketMicCode?.trim() || null,
                normalizeOptionalUpper(input.currency),
                input.instrumentType?.trim() || null,
                input.productCategory?.trim() || null,
                input.marketSegment?.trim() || null,
                input.rawPayload ? JSON.stringify(input.rawPayload) : null,
            ],
        );

        return mapReferenceInstrumentRow(result.rows[0]);
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listReferenceInstrumentsByIsin(isin: string, sourceKey?: string): Promise<DbMarketReferenceInstrument[]> {
    try {
        const normalizedIsin = assertIsin(isin);
        const result = await queryPostgres<Record<string, unknown>>(
            `select id, source_key, isin, wkn, name, symbol, mnemonic, exchange, mic_code, primary_market_mic_code, currency, instrument_type, product_category, market_segment, raw_payload, imported_at
             from market_reference_instruments
             where isin = $1
               and ($2::text is null or source_key = $2)
             order by imported_at desc, id asc`,
            [normalizedIsin, sourceKey ? normalizeSourceKey(sourceKey) : null],
        );
        return result.rows.map((row) => mapReferenceInstrumentRow(row));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listXetraReferenceCandidates(
    input: ListXetraReferenceCandidatesInput = {},
): Promise<DbXetraReferenceCandidate[]> {
    try {
        const sourceKey = normalizeSourceKey(input.sourceKey ?? "xetra_all_tradable_instruments");
        const normalizedIsin = input.isin ? assertIsin(input.isin) : null;
        const limit = Number.isFinite(input.limit) && (input.limit ?? 0) > 0 ? Math.floor(input.limit as number) : 10000;
        const excludeIsins = (input.excludeIsins ?? []).map((isin) => assertIsin(isin));
        const instrumentTypes = (input.instrumentTypes ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
        const preferEtfs = Boolean(input.preferEtfs);

        const result = await queryPostgres<Record<string, unknown>>(
            `select
                i.id as instrument_id,
                i.isin,
                i.name,
                (r.mnemonic || '.DE') as candidate_symbol,
                r.mnemonic,
                r.currency,
                r.instrument_type,
                r.market_segment,
                r.mic_code,
                r.primary_market_mic_code,
                exists (
                    select 1
                    from market_symbol_mappings mvp
                    where mvp.instrument_id = i.id
                      and mvp.is_primary = true
                      and mvp.verified_at is not null
                ) as has_verified_primary,
                exists (
                    select 1
                    from market_symbol_mappings mvy
                    where mvy.instrument_id = i.id
                      and mvy.provider = 'yfinance'
                      and mvy.verified_at is not null
                ) as has_verified_yfinance,
                exists (
                    select 1
                    from market_symbol_mappings map
                    where map.instrument_id = i.id
                      and map.is_primary = true
                ) as has_any_primary,
                exists (
                    select 1
                    from market_symbol_mappings mc
                    where mc.instrument_id = i.id
                      and mc.provider = 'yfinance'
                      and mc.symbol = (r.mnemonic || '.DE')
                ) as has_existing_candidate
             from market_reference_instruments r
             join market_instruments i on i.isin = r.isin
             where r.source_key = $1
               and r.isin is not null
               and r.mnemonic is not null
               and btrim(r.mnemonic) <> ''
               and ($2::text is null or r.isin = $2)
               and (cardinality($3::text[]) = 0 or r.isin <> all($3::text[]))
               and (cardinality($4::text[]) = 0 or lower(coalesce(r.instrument_type, '')) = any($4::text[]))
               and (
                    not $5::boolean
                    or lower(coalesce(r.instrument_type, '')) like '%etf%'
                    or lower(coalesce(r.instrument_type, '')) like '%fund%'
                    or lower(coalesce(r.market_segment, '')) like '%etf%'
                    or lower(coalesce(r.market_segment, '')) like '%fund%'
               )
             order by r.imported_at desc, i.isin asc
             limit $6`,
            [sourceKey, normalizedIsin, excludeIsins, instrumentTypes, preferEtfs, limit],
        );
        return result.rows.map((row) => mapXetraReferenceCandidateRow(row));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function insertSymbolMappingCandidate(input: InsertSymbolMappingCandidateInput): Promise<boolean> {
    try {
        const provider = input.provider.trim().toLowerCase();
        const symbol = input.symbol.trim().toUpperCase();
        if (!provider || !symbol) {
            throw new MarketDataRepositoryError("invalid_input", "Provider oder Symbol fehlt.");
        }

        const result = await queryPostgres<{ id: string }>(
            `insert into market_symbol_mappings
                (instrument_id, provider, symbol, exchange, currency, is_primary, is_active, verified_at, notes)
             values
                ($1, $2, $3, $4, $5, false, true, null, $6)
             on conflict do nothing
             returning id`,
            [input.instrumentId, provider, symbol, input.exchange ?? null, input.currency ?? null, input.notes ?? null],
        );
        return result.rows.length > 0;
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function enrichMarketInstrumentsFromReferences(
    input: EnrichMarketInstrumentsFromReferencesInput,
): Promise<EnrichMarketInstrumentsFromReferencesResult> {
    try {
        const sourceKey = normalizeSourceKey(input.sourceKey);
        const normalizedIsin = input.isin ? assertIsin(input.isin) : null;
        const limit = Number.isFinite(input.limit) && (input.limit ?? 0) > 0 ? Math.floor(input.limit as number) : 100000;
        const forceName = Boolean(input.forceName);

        const candidatesResult = await queryPostgres<Record<string, unknown>>(
            `select distinct on (i.id)
                i.id as instrument_id,
                i.isin,
                i.name as instrument_name,
                i.asset_type as instrument_asset_type,
                i.currency as instrument_currency,
                i.wkn as instrument_wkn,
                r.name as reference_name,
                r.instrument_type as reference_type,
                r.currency as reference_currency,
                r.wkn as reference_wkn
             from market_instruments i
             join market_reference_instruments r on r.isin = i.isin
             where r.source_key = $1
               and ($2::text is null or i.isin = $2)
             order by i.id, r.imported_at desc
             limit $3`,
            [sourceKey, normalizedIsin, limit],
        );

        let updated = 0;
        let nameUpdates = 0;
        let wknUpdates = 0;
        let currencyUpdates = 0;
        let assetTypeUpdates = 0;

        await withPostgresClient(async (client) => {
            await client.query("begin");
            try {
                for (const row of candidatesResult.rows) {
                    const updates: string[] = [];
                    const params: Array<string | null> = [];

                    const currentIsin = String(row.isin);
                    const currentName = row.instrument_name === null ? null : String(row.instrument_name);
                    const currentAssetType = row.instrument_asset_type === null ? null : String(row.instrument_asset_type);
                    const currentCurrency = row.instrument_currency === null ? null : String(row.instrument_currency);
                    const currentWkn = row.instrument_wkn === null ? null : String(row.instrument_wkn);
                    const referenceName = row.reference_name === null ? null : String(row.reference_name).trim();
                    const referenceWkn = row.reference_wkn === null ? null : String(row.reference_wkn).trim().toUpperCase();
                    const referenceCurrency = row.reference_currency === null ? null : String(row.reference_currency).trim().toUpperCase();
                    const assetTypeHint = toAssetTypeHint(row.reference_type === null ? null : String(row.reference_type));

                    if (!currentWkn && referenceWkn) {
                        params.push(referenceWkn);
                        updates.push(`wkn = $${params.length}`);
                        wknUpdates += 1;
                    }

                    if (!currentCurrency && referenceCurrency) {
                        params.push(referenceCurrency);
                        updates.push(`currency = $${params.length}`);
                        currencyUpdates += 1;
                    }

                    if (assetTypeHint && isAssetTypeWeak(currentAssetType)) {
                        params.push(assetTypeHint);
                        updates.push(`asset_type = $${params.length}`);
                        assetTypeUpdates += 1;
                    }

                    if (referenceName && (forceName || isNameWeak(currentName, currentIsin))) {
                        params.push(referenceName);
                        updates.push(`name = $${params.length}`);
                        nameUpdates += 1;
                    }

                    if (updates.length === 0) {
                        continue;
                    }

                    params.push(sourceKey);
                    params.push(String(row.instrument_id));
                    await client.query(
                        `update market_instruments
                         set ${updates.join(", ")},
                             metadata_source = $${params.length - 1},
                             metadata_updated_at = now(),
                             updated_at = now()
                         where id = $${params.length}`,
                        params,
                    );
                    updated += 1;
                }

                await client.query("commit");
            } catch (error) {
                await client.query("rollback");
                throw error;
            }
        });

        return {
            matched: candidatesResult.rows.length,
            updated,
            nameUpdates,
            wknUpdates,
            currencyUpdates,
            assetTypeUpdates,
        };
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
