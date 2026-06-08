
import { PostgresConfigError, queryPostgres, withPostgresClient } from "../../db/postgres-core";
import type {
    AddMarketDataRunItemInput,
    AssetLatestMarketPriceSnapshot,
    CreateMarketDataRunInput,
    DbAsset,
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
    PrimaryMappingPriceQualityRow,
    MarketDataInstrumentStatus,
    MarketInstrumentStatusSummaryRow,
    UpdateMarketInstrumentStatusInput,
    UpdateMarketInstrumentMetadataInput,
    EnrichMarketInstrumentsFromReferencesInput,
    EnrichMarketInstrumentsFromReferencesResult,
    EnrichMarketInstrumentsFromTradingUniverseInput,
    EnrichMarketInstrumentsFromTradingUniverseResult,
    FindAssetInput,
    FindLatestMarketPriceByAssetKeyInput,
    FindLatestMarketPricesByAssetKeysInput,
    DbMarketReferenceInstrument,
    DbMarketReferenceSource,
    DbXetraReferenceCandidate,
    InsertSymbolMappingCandidateInput,
    InsertManualSymbolMappingInput,
    ListXetraReferenceCandidatesInput,
    UpsertReferenceInstrumentInput,
    UpsertReferenceSourceInput,
    UpdateSymbolMappingValidationInput,
    UpdateSymbolMappingByIdInput,
    ReplacePrimaryMappingPriceHistoryInput,
    SymbolMappingForPrimaryPreference,
    UpsertDailyPricesInput,
    UpsertInstrumentInput,
    UpsertMarketActionsInput,
    UpsertSymbolMappingInput,
    TradingUniverseReferenceMatch,
    ReferenceSourceCount,
    AdminOpenUnmappedMarketDataRow,
    AdminMarketInstrumentOverviewRow,
    AdminMarketSymbolMappingOverviewRow,
    AdminMarketDataRunOverviewRow,
    DbMarketDataRequest,
    ListMarketDataRequestsInput,
    ListMarketDataRequestsResult,
    MarketDataRequestStatus,
    RecordMarketDataRequestInput,
    StoreVerifiedSymbolMappingCandidateInput,
    StoreVerifiedSymbolMappingCandidateResult,
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

function normalizeAssetKeyType(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        throw new MarketDataRepositoryError("invalid_input", "asset_key_type fehlt.");
    }
    return normalized;
}

function normalizeAssetKeyValue(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
        throw new MarketDataRepositoryError("invalid_input", "asset_key_value fehlt.");
    }
    return normalized;
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

function extractCalendarDatePrefix(value: string): string | null {
    const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
    return match?.[1] ?? null;
}

function formatLocalDateParts(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function toDateString(value: string): string {
    const prefixedDate = extractCalendarDatePrefix(value);
    if (prefixedDate) {
        return prefixedDate;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new MarketDataRepositoryError("invalid_input", "Ungültiges Datum.");
    }
    return formatLocalDateParts(date);
}

function normalizeDbDateValue(value: unknown): string {
    if (typeof value === "string") {
        const normalized = value.trim();
        const prefixedDate = extractCalendarDatePrefix(normalized);
        if (prefixedDate) {
            return prefixedDate;
        }

        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) {
            return formatLocalDateParts(parsed);
        }

        return normalized;
    }

    if (value instanceof Date) {
        return formatLocalDateParts(value);
    }

    const fallback = String(value ?? "");
    const prefixedDate = extractCalendarDatePrefix(fallback);
    if (prefixedDate) {
        return prefixedDate;
    }
    const parsed = new Date(fallback);
    if (!Number.isNaN(parsed.getTime())) {
        return formatLocalDateParts(parsed);
    }

    return fallback;
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
        marketDataStatus:
            row.market_data_status === null ? null : (String(row.market_data_status).toLowerCase() as MarketDataInstrumentStatus),
        marketDataStatusReason: row.market_data_status_reason === null ? null : String(row.market_data_status_reason),
        marketDataSuccessorIsin: row.market_data_successor_isin === null ? null : String(row.market_data_successor_isin),
        marketDataSuccessorSymbol: row.market_data_successor_symbol === null ? null : String(row.market_data_successor_symbol),
        marketDataStatusUpdatedAt: row.market_data_status_updated_at === null ? null : String(row.market_data_status_updated_at),
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
        date: normalizeDbDateValue(row.price_date),
        open: toNullableNumber(row.open_price),
        high: toNullableNumber(row.high_price),
        low: toNullableNumber(row.low_price),
        close: Number(row.close_price),
        adjClose: toNullableNumber(row.adjusted_close_price),
        volume: toNullableNumber(row.volume),
        currency: row.currency === null ? null : String(row.currency),
        source: row.source === null ? null : String(row.source),
        importedAt: String(row.imported_at),
    };
}

function mapActionRow(row: Record<string, unknown>): DbMarketAction {
    return {
        actionType: String(row.action_type),
        date: normalizeDbDateValue(row.date),
        amount: toNullableNumber(row.amount),
        ratio: row.ratio === null ? null : String(row.ratio),
        currency: row.currency === null ? null : String(row.currency),
        source: row.source === null ? null : String(row.source),
        importedAt: String(row.imported_at),
    };
}

function mapJsonObjectNumberRecord(value: unknown): Record<string, number> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    const entries = Object.entries(value as Record<string, unknown>)
        .map(([key, raw]) => [String(key), Number(raw)] as const)
        .filter(([, count]) => Number.isFinite(count));

    return Object.fromEntries(entries);
}

function describeRepositoryError(error: unknown): string | null {
    if (error instanceof Error) {
        const message = error.message.replace(/\s+/g, " ").trim();
        return message ? message.slice(0, 300) : null;
    }
    return null;
}

function handleRepositoryError(error: unknown, context?: string): never {
    if (error instanceof MarketDataRepositoryError) {
        throw error;
    }
    if (error instanceof PostgresConfigError) {
        throw new MarketDataRepositoryError("missing_db_config", error.message);
    }
    const detail = describeRepositoryError(error);
    const prefix = context
        ? `Marktdaten-DB Fehler in ${context}.`
        : "Marktdaten-DB ist derzeit nicht verfügbar.";
    throw new MarketDataRepositoryError(
        "db_error",
        detail ? `${prefix} ${detail}` : prefix,
    );
}

function normalizeInstrumentStatus(status: string): MarketDataInstrumentStatus {
    const normalized = status.trim().toLowerCase();
    if (
        normalized !== "active" &&
        normalized !== "excluded" &&
        normalized !== "legacy" &&
        normalized !== "derivative" &&
        normalized !== "unknown"
    ) {
        throw new MarketDataRepositoryError("invalid_input", "Ungültiger market_data_status.");
    }
    return normalized as MarketDataInstrumentStatus;
}

function mapAssetRow(row: Record<string, unknown>): DbAsset {
    return {
        id: String(row.id),
        assetKeyType: String(row.asset_key_type),
        assetKeyValue: String(row.asset_key_value),
        isin: row.isin === null ? null : String(row.isin),
        wkn: row.wkn === null ? null : String(row.wkn),
        displayName: row.display_name === null ? null : String(row.display_name),
        assetType: row.asset_type === null ? null : String(row.asset_type),
        currency: row.currency === null ? null : String(row.currency),
        exchange: row.exchange === null ? null : String(row.exchange),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}

function mapLatestMarketPriceSnapshotRow(row: Record<string, unknown>): AssetLatestMarketPriceSnapshot {
    return {
        assetId: String(row.asset_id),
        assetKeyType: String(row.asset_key_type),
        assetKeyValue: String(row.asset_key_value),
        isin: row.isin === null ? null : String(row.isin),
        provider: String(row.provider),
        priceAmount: Number(row.close_price),
        currency: row.currency === null ? null : String(row.currency),
        priceDate: normalizeDbDateValue(row.price_date),
        priceTimestamp: row.price_timestamp === null ? null : String(row.price_timestamp),
        updatedAt: String(row.updated_at),
    };
}

const MARKET_DATA_REQUEST_STATUSES = new Set<MarketDataRequestStatus>([
    "pending",
    "known_instrument",
    "mapping_missing",
    "import_ready",
    "imported",
    "failed",
    "ignored",
]);

function normalizeNonEmptyText(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized ? normalized : null;
}

function normalizeMarketDataRequestStatus(status: string): MarketDataRequestStatus {
    const normalized = status.trim().toLowerCase() as MarketDataRequestStatus;
    if (!MARKET_DATA_REQUEST_STATUSES.has(normalized)) {
        throw new MarketDataRepositoryError("invalid_input", "Ungültiger request status.");
    }
    return normalized;
}

function mapMarketDataRequestRow(row: Record<string, unknown>): DbMarketDataRequest {
    return {
        id: String(row.id),
        isin: String(row.isin),
        name: row.name === null ? null : String(row.name),
        displayName: row.display_name === null ? null : String(row.display_name),
        assetType: row.asset_type === null ? null : String(row.asset_type),
        currency: row.currency === null ? null : String(row.currency),
        wkn: row.wkn === null ? null : String(row.wkn),
        firstSeenAt: String(row.first_seen_at),
        lastSeenAt: String(row.last_seen_at),
        seenCount: Number(row.seen_count ?? 0),
        status: normalizeMarketDataRequestStatus(String(row.status)),
        source: String(row.source),
        notes: row.notes === null ? null : String(row.notes),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}

export async function findAsset(input: FindAssetInput): Promise<DbAsset | null> {
    try {
        if ("isin" in input) {
            const normalizedIsin = assertIsin(input.isin);
            const result = await queryPostgres<Record<string, unknown>>(
                `select id, asset_key_type, asset_key_value, isin, wkn, display_name, asset_type, currency, exchange, created_at, updated_at
                 from assets
                 where isin = $1
                 limit 1`,
                [normalizedIsin],
            );
            const row = result.rows[0];
            return row ? mapAssetRow(row) : null;
        }

        const assetKeyType = normalizeAssetKeyType(input.assetKeyType);
        const assetKeyValue = normalizeAssetKeyValue(input.assetKeyValue);
        const result = await queryPostgres<Record<string, unknown>>(
            `select id, asset_key_type, asset_key_value, isin, wkn, display_name, asset_type, currency, exchange, created_at, updated_at
             from assets
             where asset_key_type = $1
               and asset_key_value = $2
             limit 1`,
            [assetKeyType, assetKeyValue],
        );
        const row = result.rows[0];
        return row ? mapAssetRow(row) : null;
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function findLatestMarketPriceByAssetKey(
    input: FindLatestMarketPriceByAssetKeyInput,
): Promise<AssetLatestMarketPriceSnapshot | null> {
    try {
        const assetKeyType = normalizeAssetKeyType(input.assetKeyType);
        const assetKeyValue = normalizeAssetKeyValue(input.assetKeyValue);
        const provider = input.provider?.trim().toLowerCase() || null;
        const result = await queryPostgres<Record<string, unknown>>(
            `select
                p.asset_id,
                a.asset_key_type,
                a.asset_key_value,
                a.isin,
                p.provider,
                p.close_price,
                p.currency,
                p.price_date,
                p.price_timestamp,
                p.updated_at
             from assets a
             join lateral (
                select p.asset_id, p.provider, p.close_price, p.currency, p.price_date, p.price_timestamp, p.updated_at
                from asset_daily_prices p
                where p.asset_id = a.id
                  and ($3::text is null or p.provider = $3)
                order by p.price_date desc, p.updated_at desc
                limit 1
             ) p on true
             where a.asset_key_type = $1
               and a.asset_key_value = $2
             limit 1`,
            [assetKeyType, assetKeyValue, provider],
        );
        const row = result.rows[0];
        return row ? mapLatestMarketPriceSnapshotRow(row) : null;
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function findLatestMarketPricesByAssetKeys(
    input: FindLatestMarketPricesByAssetKeysInput,
): Promise<Record<string, AssetLatestMarketPriceSnapshot>> {
    try {
        const provider = input.provider?.trim().toLowerCase() || null;
        const keys = input.keys
            .map((key) => ({
                assetKeyType: normalizeAssetKeyType(key.assetKeyType),
                assetKeyValue: normalizeAssetKeyValue(key.assetKeyValue),
            }))
            .filter((key, index, array) => array.findIndex((item) => item.assetKeyType === key.assetKeyType && item.assetKeyValue === key.assetKeyValue) === index);

        if (keys.length === 0) {
            return {};
        }

        const assetKeyTypes = keys.map((key) => key.assetKeyType);
        const assetKeyValues = keys.map((key) => key.assetKeyValue);
        const result = await queryPostgres<Record<string, unknown>>(
            `with input_keys as (
                select *
                from unnest($1::text[], $2::text[]) as t(asset_key_type, asset_key_value)
             ),
             target_assets as (
                select a.id, a.asset_key_type, a.asset_key_value, a.isin
                from assets a
                join input_keys k
                  on k.asset_key_type = a.asset_key_type
                 and k.asset_key_value = a.asset_key_value
             ),
             latest_prices as (
                select distinct on (p.asset_id)
                    p.asset_id,
                    p.provider,
                    p.close_price,
                    p.currency,
                    p.price_date,
                    p.price_timestamp,
                    p.updated_at
                from asset_daily_prices p
                join target_assets a on a.id = p.asset_id
                where ($3::text is null or p.provider = $3)
                order by p.asset_id, p.price_date desc, p.updated_at desc
             )
             select
                a.id as asset_id,
                a.asset_key_type,
                a.asset_key_value,
                a.isin,
                p.provider,
                p.close_price,
                p.currency,
                p.price_date,
                p.price_timestamp,
                p.updated_at
             from target_assets a
             join latest_prices p on p.asset_id = a.id`,
            [assetKeyTypes, assetKeyValues, provider],
        );

        const mapped: Record<string, AssetLatestMarketPriceSnapshot> = {};
        for (const row of result.rows) {
            const item = mapLatestMarketPriceSnapshotRow(row);
            mapped[`${item.assetKeyType}:${item.assetKeyValue}`] = item;
        }
        return mapped;
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function getInstrumentByIsin(isin: string): Promise<DbMarketInstrument | null> {
    try {
        const normalizedIsin = assertIsin(isin);
        const result = await queryPostgres<Record<string, unknown>>(
            `select id, isin, name, display_name, asset_type, currency, wkn, metadata_source, metadata_updated_at,
                    name_source, display_name_source, display_metadata_updated_at, market_data_status, market_data_status_reason,
                    market_data_successor_isin, market_data_successor_symbol, market_data_status_updated_at, created_at, updated_at
             from assets
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
            `insert into assets
                (asset_key_type, asset_key_value, isin, name, display_name, asset_type, currency, wkn, metadata_source, metadata_updated_at, name_source, display_name_source, display_metadata_updated_at)
             values
                ('isin', $1, $1, $2, $3, $4, $5, $6, $7, case when $7::text is null then null else now() end, $8, $9, case when $9::text is null then null else now() end)
             on conflict (asset_key_type, asset_key_value)
             do update set
               isin = excluded.isin,
               name = excluded.name,
               display_name = excluded.display_name,
               asset_type = excluded.asset_type,
               currency = excluded.currency,
               wkn = excluded.wkn,
               metadata_source = excluded.metadata_source,
               metadata_updated_at = case when excluded.metadata_source is null then assets.metadata_updated_at else now() end,
               name_source = excluded.name_source,
               display_name_source = excluded.display_name_source,
               display_metadata_updated_at = case when excluded.display_name_source is null then assets.display_metadata_updated_at else now() end,
               updated_at = now()
             returning id, isin, name, display_name, asset_type, currency, wkn, metadata_source, metadata_updated_at,
                       name_source, display_name_source, display_metadata_updated_at, market_data_status, market_data_status_reason,
                       market_data_successor_isin, market_data_successor_symbol, market_data_status_updated_at, created_at, updated_at`,
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
        handleRepositoryError(error, "upsertInstrument(assets)");
    }
}

export async function listMarketInstruments(input: ListMarketInstrumentsInput = {}): Promise<DbMarketInstrument[]> {
    try {
        const limit = Number.isFinite(input.limit) && (input.limit ?? 0) > 0 ? Math.floor(input.limit as number) : 5000;
        const result = await queryPostgres<Record<string, unknown>>(
            `select id, isin, name, display_name, asset_type, currency, wkn, metadata_source, metadata_updated_at,
                    name_source, display_name_source, display_metadata_updated_at, market_data_status, market_data_status_reason,
                    market_data_successor_isin, market_data_successor_symbol, market_data_status_updated_at, created_at, updated_at
             from assets
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
                    i.name_source, i.display_name_source, i.display_metadata_updated_at, i.market_data_status, i.market_data_status_reason,
                    i.market_data_successor_isin, i.market_data_successor_symbol, i.market_data_status_updated_at
             from assets i
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
                marketDataStatus:
                    row.market_data_status === null ? null : (String(row.market_data_status).toLowerCase() as MarketDataInstrumentStatus),
                marketDataStatusReason: row.market_data_status_reason === null ? null : String(row.market_data_status_reason),
                marketDataSuccessorIsin: row.market_data_successor_isin === null ? null : String(row.market_data_successor_isin),
                marketDataSuccessorSymbol: row.market_data_successor_symbol === null ? null : String(row.market_data_successor_symbol),
                marketDataStatusUpdatedAt: row.market_data_status_updated_at === null ? null : String(row.market_data_status_updated_at),
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

function hasLetters(value: string): boolean {
    return /[a-zA-Z]/.test(value);
}

function isLikelyPlaceholderName(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized === "unknown" || normalized === "n/a" || normalized === "na" || normalized === "undefined" || normalized === "null";
}

function hasFundLikeTerms(value: string): boolean {
    return /\b(etf|ucits|fund|fonds|index)\b/i.test(value);
}

export function compareInstrumentNameQuality(currentName: string | null, candidateName: string | null, isin: string): number {
    const current = currentName?.trim() ?? "";
    const candidate = candidateName?.trim() ?? "";
    const normalizedIsin = isin.trim().toUpperCase();

    if (!candidate || isLikelyPlaceholderName(candidate) || candidate.toUpperCase() === normalizedIsin) return -1000;
    if (!current || isLikelyPlaceholderName(current) || current.toUpperCase() === normalizedIsin) return 1000;

    if (hasFundLikeTerms(current) && !hasFundLikeTerms(candidate)) return -100;
    if (!hasFundLikeTerms(current) && hasFundLikeTerms(candidate)) return 100;
    if (hasLetters(candidate) && !hasLetters(current)) return 20;
    if (!hasLetters(candidate) && hasLetters(current)) return -20;

    const lengthDelta = Math.min(30, candidate.length - current.length);
    const uppercasePenalty = /^[A-Z0-9 .&/-]+$/.test(candidate) && !/[a-z]/.test(candidate) ? -5 : 0;
    return lengthDelta + uppercasePenalty;
}

export async function upsertReferenceSource(input: UpsertReferenceSourceInput): Promise<DbMarketReferenceSource> {
    try {
        const sourceKey = normalizeSourceKey(input.sourceKey);
        const result = await queryPostgres<Record<string, unknown>>(
            `insert into reference_data_sources
                (provider, source_name, source_type, source_key, display_name, file_name, row_count, imported_at, notes)
             values
                ('legacy_market_data', $1, $3, $1, $2, $4, $5, now(), $6)
             on conflict (source_key)
             do update set
               provider = excluded.provider,
               source_name = excluded.source_name,
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
        handleRepositoryError(error, "upsertReferenceSource(reference_data_sources)");
    }
}

async function ensureMarketDataRunSource(input: {
    provider: string;
    runType: string;
}): Promise<{ sourceId: string }> {
    const provider = input.provider.trim().toLowerCase();
    const runType = input.runType.trim();
    const sourceKey = `market_data_run:${provider}:${runType}`;
    const sourceName = `${provider}:${runType}`;

    const result = await queryPostgres<{ id: string }>(
        `insert into reference_data_sources
            (provider, source_name, source_type, source_key, display_name, imported_at, notes)
         values
            ($1, $2, 'market_data_run', $3, $4, now(), $5)
         on conflict (source_key)
         do update set
            provider = excluded.provider,
            source_name = excluded.source_name,
            source_type = excluded.source_type,
            display_name = excluded.display_name,
            imported_at = now(),
            notes = excluded.notes
         returning id`,
        [
            provider,
            sourceName,
            sourceKey,
            `Market data run ${provider}/${runType}`,
            "Auto-created source row for incremental market-data run logging.",
        ],
    );

    return { sourceId: result.rows[0].id };
}

export async function listReferenceSourceCounts(): Promise<ReferenceSourceCount[]> {
    try {
        const result = await queryPostgres<Record<string, unknown>>(
            `select source_key, count(*)::int as row_count
             from reference_data_asset_candidates
             group by source_key
             order by source_key asc`,
        );
        return result.rows.map((row) => ({
            sourceKey: String(row.source_key),
            rowCount: Number(row.row_count ?? 0),
        }));
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
        const sourceResult = await queryPostgres<{ id: string }>(
            `select id
             from reference_data_sources
             where provider = 'legacy_market_data'
               and source_key = $1
             limit 1`,
            [sourceKey],
        );
        const sourceId = sourceResult.rows[0]?.id;
        if (!sourceId) {
            throw new MarketDataRepositoryError("db_error", `reference_data_sources source missing for ${sourceKey}.`);
        }
        const result = await queryPostgres<Record<string, unknown>>(
            `insert into reference_data_asset_candidates
                (source_id, source_key, asset_id, isin, wkn, name, display_name, provider_symbol, symbol, mnemonic, exchange, mic_code, primary_market_mic_code, currency, asset_type, instrument_type, product_category, market_segment, raw_payload, imported_at)
             values
                ($1, $2, null, $3, $4, $5, $5, $6, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, now())
             on conflict (source_key, isin, coalesce(symbol, ''), coalesce(mnemonic, ''))
             do update set
                wkn = excluded.wkn,
                name = excluded.name,
                display_name = excluded.display_name,
                provider_symbol = excluded.provider_symbol,
                symbol = excluded.symbol,
                exchange = excluded.exchange,
                mic_code = excluded.mic_code,
                primary_market_mic_code = excluded.primary_market_mic_code,
                currency = excluded.currency,
                asset_type = excluded.asset_type,
                instrument_type = excluded.instrument_type,
                product_category = excluded.product_category,
                market_segment = excluded.market_segment,
                raw_payload = excluded.raw_payload,
                imported_at = now()
             returning id, source_key, isin, wkn, name, display_name, provider_symbol, symbol, mnemonic, exchange, mic_code, primary_market_mic_code, currency, asset_type, instrument_type, product_category, market_segment, raw_payload, imported_at`,
            [
                sourceId,
                sourceKey,
                isin,
                normalizeOptionalUpper(input.wkn),
                input.name?.trim() || null,
                symbol,
                symbol,
                mnemonic,
                input.exchange?.trim() || null,
                input.micCode?.trim() || null,
                input.primaryMarketMicCode?.trim() || null,
                normalizeOptionalUpper(input.currency),
                input.instrumentType?.trim() || null,
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
             from reference_data_asset_candidates
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
                    from asset_symbol_mappings mvp
                    where mvp.instrument_id = i.id
                      and mvp.is_primary = true
                      and mvp.verified_at is not null
                ) as has_verified_primary,
                exists (
                    select 1
                    from asset_symbol_mappings mvy
                    where mvy.instrument_id = i.id
                      and mvy.provider = 'yfinance'
                      and mvy.verified_at is not null
                ) as has_verified_yfinance,
                exists (
                    select 1
                    from asset_symbol_mappings map
                    where map.instrument_id = i.id
                      and map.is_primary = true
                ) as has_any_primary,
                exists (
                    select 1
                    from asset_symbol_mappings mc
                    where mc.instrument_id = i.id
                      and mc.provider = 'yfinance'
                      and mc.symbol = (r.mnemonic || '.DE')
                ) as has_existing_candidate
             from reference_data_asset_candidates r
             join assets i on i.isin = r.isin
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
        const instrumentId = String(input.instrumentId ?? "").trim();
        if (!provider || !symbol) {
            throw new MarketDataRepositoryError("invalid_input", "Provider oder Symbol fehlt.");
        }
        if (!instrumentId) {
            throw new MarketDataRepositoryError("invalid_input", "Instrument-ID fehlt.");
        }

        const result = await queryPostgres<{ id: string }>(
            `insert into asset_symbol_mappings
                (asset_id, instrument_id, provider, provider_symbol, symbol, exchange, currency, is_primary, is_active, verified_at, notes)
             values
                ($1, $1, $2, $3, $3, $4, $5, false, true, null, $6)
             on conflict do nothing
             returning id`,
            [instrumentId, provider, symbol, input.exchange ?? null, input.currency ?? null, input.notes ?? null],
        );
        return result.rows.length > 0;
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function insertManualSymbolMapping(input: InsertManualSymbolMappingInput): Promise<DbMarketSymbolMapping | null> {
    try {
        const provider = input.provider.trim().toLowerCase();
        const symbol = input.symbol.trim().toUpperCase();
        const instrumentId = String(input.instrumentId ?? "").trim();
        if (!provider || !symbol) {
            throw new MarketDataRepositoryError("invalid_input", "Provider oder Symbol fehlt.");
        }
        if (!instrumentId) {
            throw new MarketDataRepositoryError("invalid_input", "Instrument-ID fehlt.");
        }

        const result = await queryPostgres<Record<string, unknown>>(
            `insert into asset_symbol_mappings
                (asset_id, instrument_id, provider, provider_symbol, symbol, exchange, currency, is_primary, is_active, verified_at, notes)
             values
                ($1, $1, $2, $3, $3, $4, $5, $6, $7, $8, $9)
             on conflict do nothing
             returning id, instrument_id, provider, symbol, exchange, currency, is_primary, is_active,
                       verified_at, notes, created_at, updated_at`,
            [
                instrumentId,
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
        const row = result.rows[0];
        return row ? mapSymbolMappingRow(row) : null;
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function updateSymbolMappingById(input: UpdateSymbolMappingByIdInput): Promise<DbMarketSymbolMapping | null> {
    try {
        const id = String(input.id ?? "").trim();
        if (!id) {
            throw new MarketDataRepositoryError("invalid_input", "Mapping-ID fehlt.");
        }

        const symbol = input.symbol === undefined ? null : input.symbol.trim().toUpperCase();
        if (symbol !== null && !symbol) {
            throw new MarketDataRepositoryError("invalid_input", "Symbol fehlt.");
        }

        const result = await queryPostgres<Record<string, unknown>>(
            `update asset_symbol_mappings
             set provider_symbol = coalesce($2, provider_symbol),
                 symbol = coalesce($2, symbol),
                 exchange = coalesce($3::text, exchange),
                 currency = coalesce($4::text, currency),
                 is_primary = coalesce($5::boolean, is_primary),
                 is_active = coalesce($6::boolean, is_active),
                 verified_at = case
                     when $8::boolean then null
                     when $7::timestamptz is not null then $7::timestamptz
                     else verified_at
                 end,
                 notes = coalesce($9::text, notes),
                 updated_at = now()
             where id = $1
             returning id, instrument_id, provider, symbol, exchange, currency, is_primary, is_active,
                       verified_at, notes, created_at, updated_at`,
            [
                id,
                symbol,
                input.exchange,
                input.currency,
                input.isPrimary ?? null,
                input.isActive ?? null,
                input.verifiedAt ?? null,
                input.clearVerifiedAt === true,
                input.notes ?? null,
            ],
        );
        const row = result.rows[0];
        return row ? mapSymbolMappingRow(row) : null;
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
             from assets i
             join reference_data_asset_candidates r on r.isin = i.isin
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
                        `update assets
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

function isMeaningfulTradingUniverseName(value: string | null, isin: string): boolean {
    if (!value) return false;
    const normalized = value.trim();
    if (!normalized) return false;
    if (isLikelyPlaceholderName(normalized)) return false;
    if (normalized.toUpperCase() === isin.toUpperCase()) return false;
    return hasLetters(normalized);
}

export async function listTradingUniverseReferenceMatches(input: {
    sourceKey?: string;
    isin?: string;
    limit?: number;
    setDisplayName?: boolean;
    forceName?: boolean;
    forceDisplayName?: boolean;
} = {}): Promise<TradingUniverseReferenceMatch[]> {
    try {
        const sourceKey = normalizeSourceKey(input.sourceKey ?? "trading_universe");
        const normalizedIsin = input.isin ? assertIsin(input.isin) : null;
        const limit = Number.isFinite(input.limit) && (input.limit ?? 0) > 0 ? Math.floor(input.limit as number) : 10000;
        const setDisplayName = Boolean(input.setDisplayName);
        const forceName = Boolean(input.forceName);
        const forceDisplayName = Boolean(input.forceDisplayName);

        const result = await queryPostgres<Record<string, unknown>>(
            `select i.isin,
                    i.name as current_name,
                    i.display_name as current_display_name,
                    r.name as reference_name
             from assets i
             join lateral (
                select rr.name
                from reference_data_asset_candidates rr
                where rr.source_key = $1
                  and rr.isin = i.isin
                order by rr.imported_at desc, rr.id desc
                limit 1
             ) r on true
             where ($2::text is null or i.isin = $2)
             order by i.isin asc
             limit $3`,
            [sourceKey, normalizedIsin, limit],
        );

        return result.rows.map((row) => {
            const isin = String(row.isin);
            const currentName = row.current_name === null ? null : String(row.current_name);
            const currentDisplayName = row.current_display_name === null ? null : String(row.current_display_name);
            const referenceName = row.reference_name === null ? null : String(row.reference_name);
            const meaningfulRef = isMeaningfulTradingUniverseName(referenceName, isin);
            const nameQuality = compareInstrumentNameQuality(currentName, referenceName, isin);
            const displayQuality = compareInstrumentNameQuality(currentDisplayName, referenceName, isin);
            const currentNameWeak = !currentName || isNameWeak(currentName, isin);
            const currentDisplayNameWeak = !currentDisplayName || isNameWeak(currentDisplayName, isin);

            const plannedNameUpdate = meaningfulRef && (forceName || currentNameWeak || nameQuality > 0);
            const plannedDisplayNameUpdate =
                setDisplayName &&
                meaningfulRef &&
                (forceDisplayName || currentDisplayNameWeak || displayQuality > 0);
            const existingBetter =
                meaningfulRef &&
                !forceName &&
                !currentNameWeak &&
                nameQuality <= 0 &&
                (!setDisplayName || forceDisplayName || !currentDisplayNameWeak);

            return {
                isin,
                currentName,
                currentDisplayName,
                referenceName,
                plannedNameUpdate,
                plannedDisplayNameUpdate,
                existingBetter,
            };
        });
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function enrichMarketInstrumentsFromTradingUniverse(
    input: EnrichMarketInstrumentsFromTradingUniverseInput = {},
): Promise<EnrichMarketInstrumentsFromTradingUniverseResult> {
    try {
        const sourceKey = normalizeSourceKey(input.sourceKey ?? "trading_universe");
        const matches = await listTradingUniverseReferenceMatches({
            sourceKey,
            isin: input.isin,
            limit: input.limit,
            setDisplayName: input.setDisplayName,
            forceName: input.forceName,
            forceDisplayName: input.forceDisplayName,
        });

        let updated = 0;
        let nameUpdates = 0;
        let displayNameUpdates = 0;
        let skippedExistingBetter = 0;

        await withPostgresClient(async (client) => {
            await client.query("begin");
            try {
                for (const match of matches) {
                    if (!match.plannedNameUpdate && !match.plannedDisplayNameUpdate) {
                        if (match.existingBetter) skippedExistingBetter += 1;
                        continue;
                    }

                    const updates: string[] = [];
                    const params: Array<string> = [];

                    if (match.plannedNameUpdate) {
                        params.push(String(match.referenceName));
                        updates.push(`name = $${params.length}`);
                        params.push(sourceKey);
                        updates.push(`name_source = $${params.length}`);
                        nameUpdates += 1;
                    }

                    if (match.plannedDisplayNameUpdate) {
                        params.push(String(match.referenceName));
                        updates.push(`display_name = $${params.length}`);
                        params.push(sourceKey);
                        updates.push(`display_name_source = $${params.length}`);
                        updates.push(`display_metadata_updated_at = now()`);
                        displayNameUpdates += 1;
                    }

                    params.push(match.isin);
                    await client.query(
                        `update assets
                         set ${updates.join(", ")},
                             updated_at = now()
                         where isin = $${params.length}`,
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
            matched: matches.length,
            updated,
            nameUpdates,
            displayNameUpdates,
            skippedNoMatch: 0,
            skippedExistingBetter,
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
             from asset_symbol_mappings m
             join assets i on i.id = m.instrument_id
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

export async function getPrimarySymbolMappingsByIsins(
    isins: string[],
    provider?: string,
): Promise<Record<string, DbMarketSymbolMapping>> {
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
        const normalizedProvider = provider?.trim() ? provider.trim().toLowerCase() : null;

        if (normalizedIsins.length === 0) {
            return {};
        }

        const result = await queryPostgres<Record<string, unknown>>(
            `select distinct on (i.isin)
                i.isin,
                m.id, m.instrument_id, m.provider, m.symbol, m.exchange, m.currency, m.is_primary, m.is_active,
                m.verified_at, m.notes, m.created_at, m.updated_at
             from asset_symbol_mappings m
             join assets i on i.id = m.instrument_id
             where i.isin = any($1::text[])
               and ($2::text is null or m.provider = $2)
               and m.is_active = true
             order by i.isin asc, m.is_primary desc, m.updated_at desc`,
            [normalizedIsins, normalizedProvider],
        );

        const mapped: Record<string, DbMarketSymbolMapping> = {};
        for (const row of result.rows) {
            const isin = String(row.isin);
            mapped[isin] = mapSymbolMappingRow(row);
        }

        return mapped;
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
             from asset_symbol_mappings m
             join assets i on i.id = m.instrument_id
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
             from asset_symbol_mappings
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
             from asset_symbol_mappings m
             join assets i on i.id = m.instrument_id
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
             from asset_symbol_mappings m
             join assets i on i.id = m.instrument_id
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
                instruments_total as (select count(*)::int as value from assets),
                mappings_total as (select count(*)::int as value from asset_symbol_mappings),
                yfinance_mappings_total as (select count(*)::int as value from asset_symbol_mappings where provider = 'yfinance'),
                verified_yfinance_mappings as (select count(*)::int as value from asset_symbol_mappings where provider = 'yfinance' and verified_at is not null),
                primary_yfinance_mappings as (select count(*)::int as value from asset_symbol_mappings where provider = 'yfinance' and is_primary = true),
                instruments_with_verified_yfinance as (
                    select count(distinct i.id)::int as value
                    from assets i
                    join asset_symbol_mappings m on m.instrument_id = i.id
                    where m.provider = 'yfinance' and m.verified_at is not null
                ),
                instruments_without_any_mapping as (
                    select count(*)::int as value
                    from assets i
                    left join asset_symbol_mappings m on m.instrument_id = i.id
                    where m.instrument_id is null
                ),
                instruments_with_mapping_but_no_verified_yfinance as (
                    select count(*)::int as value
                    from assets i
                    where exists (select 1 from asset_symbol_mappings m where m.instrument_id = i.id)
                      and not exists (
                          select 1
                          from asset_symbol_mappings y
                          where y.instrument_id = i.id and y.provider = 'yfinance' and y.verified_at is not null
                      )
                ),
                instruments_with_primary_yfinance as (
                    select count(distinct i.id)::int as value
                    from assets i
                    join asset_symbol_mappings m on m.instrument_id = i.id
                    where m.provider = 'yfinance' and m.is_primary = true
                ),
                instruments_without_primary_yfinance as (
                    select count(*)::int as value
                    from assets i
                    where not exists (
                        select 1
                        from asset_symbol_mappings m
                        where m.instrument_id = i.id and m.provider = 'yfinance' and m.is_primary = true
                    )
                ),
                instruments_with_daily_prices as (
                    select count(distinct i.id)::int as value
                    from assets i
                    join assets a
                      on a.asset_key_type = 'isin'
                     and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                    join asset_daily_prices p on p.asset_id = a.id
                ),
                instruments_with_actions as (
                    select count(distinct asset_id)::int as value
                    from (
                        select asset_id from dividend_events
                        union
                        select asset_id from corporate_action_events
                    ) action_assets
                ),
                instruments_with_primary_but_no_prices as (
                    select count(*)::int as value
                    from assets i
                    where exists (
                        select 1
                        from asset_symbol_mappings m
                        where m.instrument_id = i.id and m.provider = 'yfinance' and m.is_primary = true
                    )
                      and not exists (
                        select 1
                        from assets a
                        join asset_daily_prices p on p.asset_id = a.id
                        where a.asset_key_type = 'isin'
                          and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                    )
                ),
                failed_validation_candidates as (
                    select count(*)::int as value
                    from asset_symbol_mappings
                    where provider = 'yfinance'
                      and notes ilike '%validated:yfinance; status=failed%'
                ),
                instruments_status_excluded as (
                    select count(*)::int as value from assets where market_data_status = 'excluded'
                ),
                instruments_status_legacy as (
                    select count(*)::int as value from assets where market_data_status = 'legacy'
                ),
                instruments_status_derivative as (
                    select count(*)::int as value from assets where market_data_status = 'derivative'
                ),
                instruments_status_unknown as (
                    select count(*)::int as value from assets where market_data_status = 'unknown'
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
                (select value from failed_validation_candidates) as failed_validation_candidates,
                (select value from instruments_status_excluded) as instruments_status_excluded,
                (select value from instruments_status_legacy) as instruments_status_legacy,
                (select value from instruments_status_derivative) as instruments_status_derivative,
                (select value from instruments_status_unknown) as instruments_status_unknown`,
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
            instrumentsStatusExcluded: Number(row.instruments_status_excluded ?? 0),
            instrumentsStatusLegacy: Number(row.instruments_status_legacy ?? 0),
            instrumentsStatusDerivative: Number(row.instruments_status_derivative ?? 0),
            instrumentsStatusUnknown: Number(row.instruments_status_unknown ?? 0),
        };
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function getMarketInstrumentStatusByIsin(isin: string): Promise<DbMarketInstrument | null> {
    return getInstrumentByIsin(isin);
}

export async function updateMarketInstrumentMetadata(input: UpdateMarketInstrumentMetadataInput): Promise<DbMarketInstrument | null> {
    try {
        const normalizedIsin = assertIsin(input.isin);
        const updates: string[] = [];
        const params: Array<string | null> = [normalizedIsin];

        if (Object.hasOwn(input, "name")) {
            params.push(input.name ?? null);
            updates.push(`name = $${params.length}`);
        }
        if (Object.hasOwn(input, "displayName")) {
            params.push(input.displayName ?? null);
            updates.push(`display_name = $${params.length}`);
        }
        if (Object.hasOwn(input, "assetType")) {
            params.push(input.assetType ?? null);
            updates.push(`asset_type = $${params.length}`);
        }
        if (Object.hasOwn(input, "currency")) {
            params.push(input.currency ?? null);
            updates.push(`currency = $${params.length}`);
        }
        if (Object.hasOwn(input, "wkn")) {
            params.push(input.wkn ?? null);
            updates.push(`wkn = $${params.length}`);
        }

        const touchedMetadataField =
            Object.hasOwn(input, "name") ||
            Object.hasOwn(input, "displayName") ||
            Object.hasOwn(input, "assetType") ||
            Object.hasOwn(input, "currency") ||
            Object.hasOwn(input, "wkn");

        if (Object.hasOwn(input, "metadataSource")) {
            params.push(input.metadataSource ?? null);
            updates.push(`metadata_source = $${params.length}`);
        }
        if (Object.hasOwn(input, "nameSource")) {
            params.push(input.nameSource ?? null);
            updates.push(`name_source = $${params.length}`);
        }
        if (Object.hasOwn(input, "displayNameSource")) {
            params.push(input.displayNameSource ?? null);
            updates.push(`display_name_source = $${params.length}`);
        }
        if (Object.hasOwn(input, "displayName")) {
            updates.push("display_metadata_updated_at = now()");
        }
        if (touchedMetadataField || Object.hasOwn(input, "metadataSource")) {
            updates.push("metadata_updated_at = now()");
        }

        if (updates.length === 0) {
            throw new MarketDataRepositoryError("invalid_input", "Keine Felder für Metadata-Update angegeben.");
        }

        const result = await queryPostgres<Record<string, unknown>>(
            `update assets
             set ${updates.join(", ")},
                 updated_at = now()
             where isin = $1
             returning id, isin, name, display_name, asset_type, currency, wkn, metadata_source, metadata_updated_at,
                       name_source, display_name_source, display_metadata_updated_at, market_data_status, market_data_status_reason,
                       market_data_successor_isin, market_data_successor_symbol, market_data_status_updated_at, created_at, updated_at`,
            params,
        );

        const row = result.rows[0];
        return row ? mapInstrumentRow(row) : null;
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function updateMarketInstrumentStatus(input: UpdateMarketInstrumentStatusInput): Promise<DbMarketInstrument | null> {
    try {
        const normalizedIsin = assertIsin(input.isin);
        const normalizedStatus = normalizeInstrumentStatus(input.status);
        const successorIsin = normalizedStatus === "active" ? null : input.successorIsin ? assertIsin(input.successorIsin) : null;
        const successorSymbol = normalizedStatus === "active" ? null : normalizeOptionalUpper(input.successorSymbol ?? null);
        const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason.trim() : null;

        const result = await queryPostgres<Record<string, unknown>>(
            `update assets
             set market_data_status = $2,
                 market_data_status_reason = $3,
                 market_data_successor_isin = $4,
                 market_data_successor_symbol = $5,
                 market_data_status_updated_at = now(),
                 updated_at = now()
             where isin = $1
             returning id, isin, name, display_name, asset_type, currency, wkn, metadata_source, metadata_updated_at,
                       name_source, display_name_source, display_metadata_updated_at, market_data_status, market_data_status_reason,
                       market_data_successor_isin, market_data_successor_symbol, market_data_status_updated_at, created_at, updated_at`,
            [normalizedIsin, normalizedStatus, reason, successorIsin, successorSymbol],
        );

        const row = result.rows[0];
        return row ? mapInstrumentRow(row) : null;
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listMarketInstrumentStatusSummary(): Promise<MarketInstrumentStatusSummaryRow[]> {
    try {
        const result = await queryPostgres<Record<string, unknown>>(
            `select market_data_status as status, count(*)::int as count
             from assets
             group by market_data_status
             order by market_data_status nulls first`,
        );

        return result.rows.map((row) => ({
            status:
                row.status === null
                    ? null
                    : normalizeInstrumentStatus(String(row.status)),
            count: Number(row.count ?? 0),
        }));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function recordMarketDataRequest(input: RecordMarketDataRequestInput): Promise<DbMarketDataRequest | null> {
    try {
        let normalizedIsin: string;
        try {
            normalizedIsin = assertIsin(input.isin);
        } catch (error) {
            if (error instanceof MarketDataRepositoryError && error.code === "invalid_input") {
                return null;
            }
            throw error;
        }

        const metadata = {
            name: normalizeNonEmptyText(input.name),
            displayName: normalizeNonEmptyText(input.displayName),
            assetType: normalizeNonEmptyText(input.assetType),
            currency: normalizeNonEmptyText(input.currency)?.toUpperCase() ?? null,
            wkn: normalizeNonEmptyText(input.wkn)?.toUpperCase() ?? null,
            source: normalizeNonEmptyText(input.source)?.toLowerCase() ?? "runtime_asset_discovery",
        };

        return await withPostgresClient(async (client) => {
            await client.query("begin");
            try {
                await client.query(
                    `insert into assets
                        (asset_key_type, asset_key_value, isin, name, display_name, asset_type, currency, wkn, market_data_status)
                     values
                        ('isin', $1, $1, $2, $3, $4, $5, $6, 'unknown')
                     on conflict (asset_key_type, asset_key_value)
                     do update set
                        isin = excluded.isin,
                        name = coalesce(assets.name, excluded.name),
                        display_name = coalesce(assets.display_name, excluded.display_name),
                        asset_type = coalesce(assets.asset_type, excluded.asset_type),
                        currency = coalesce(assets.currency, excluded.currency),
                        wkn = coalesce(assets.wkn, excluded.wkn),
                        market_data_status = coalesce(assets.market_data_status, 'unknown'),
                        updated_at = now()`,
                    [normalizedIsin, metadata.name, metadata.displayName, metadata.assetType, metadata.currency, metadata.wkn],
                );

                const result = await client.query<Record<string, unknown>>(
                    `insert into reference_data_request_logs
                        (provider, request_type, request_key, status, isin, name, display_name, asset_type, currency, wkn, source, first_seen_at, last_seen_at)
                     values
                        ('runtime_asset_discovery', 'isin', $1, 'pending', $1, $2, $3, $4, $5, $6, $7, now(), now())
                     on conflict (provider, request_type, request_key)
                     do update set
                        seen_count = reference_data_request_logs.seen_count + 1,
                        last_seen_at = now(),
                        name = coalesce(reference_data_request_logs.name, excluded.name),
                        display_name = coalesce(reference_data_request_logs.display_name, excluded.display_name),
                        asset_type = coalesce(reference_data_request_logs.asset_type, excluded.asset_type),
                        currency = coalesce(reference_data_request_logs.currency, excluded.currency),
                        wkn = coalesce(reference_data_request_logs.wkn, excluded.wkn),
                        source = coalesce(reference_data_request_logs.source, excluded.source),
                        status = case
                            when reference_data_request_logs.status in ('imported', 'ignored') then reference_data_request_logs.status
                            else reference_data_request_logs.status
                        end,
                        updated_at = now()
                     returning id, isin, name, display_name, asset_type, currency, wkn,
                               first_seen_at, last_seen_at, seen_count, status, source, notes, created_at, updated_at`,
                    [normalizedIsin, metadata.name, metadata.displayName, metadata.assetType, metadata.currency, metadata.wkn, metadata.source],
                );

                await client.query("commit");
                return mapMarketDataRequestRow(result.rows[0]);
            } catch (error) {
                await client.query("rollback");
                throw error;
            }
        });
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listMarketDataRequests(input: ListMarketDataRequestsInput = {}): Promise<ListMarketDataRequestsResult> {
    try {
        const limit = Number.isFinite(input.limit) && (input.limit ?? 0) > 0 ? Math.min(Math.floor(input.limit as number), 200) : 50;
        const status = normalizeNonEmptyText(input.status)?.toLowerCase() ?? null;
        const source = normalizeNonEmptyText(input.source)?.toLowerCase() ?? null;
        const qRaw = normalizeNonEmptyText(input.q);
        const q = qRaw ? `%${qRaw.toLowerCase()}%` : null;

        if (status && !MARKET_DATA_REQUEST_STATUSES.has(status as MarketDataRequestStatus)) {
            throw new MarketDataRepositoryError("invalid_input", "Ungültiger request status.");
        }

        const result = await queryPostgres<Record<string, unknown>>(
            `with filtered as (
                select id, isin, name, display_name, asset_type, currency, wkn,
                       first_seen_at, last_seen_at, seen_count, status, source, notes, created_at, updated_at
                from reference_data_request_logs
                where ($1::text is null or status = $1)
                  and ($2::text is null or source = $2)
                  and (
                    $3::text is null
                    or lower(isin) like $3
                    or lower(coalesce(display_name, '')) like $3
                    or lower(coalesce(name, '')) like $3
                    or lower(coalesce(wkn, '')) like $3
                  )
            )
            select
                (select count(*)::int from filtered) as total,
                f.id, f.isin, f.name, f.display_name, f.asset_type, f.currency, f.wkn,
                f.first_seen_at, f.last_seen_at, f.seen_count, f.status, f.source, f.notes, f.created_at, f.updated_at
            from filtered f
            order by f.last_seen_at desc, f.isin asc
            limit $4`,
            [status, source, q, limit],
        );

        const total = Number(result.rows[0]?.total ?? 0);
        const items = result.rows.map((row) => mapMarketDataRequestRow(row));
        return { total, items };
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listAdminOpenUnmappedMarketDataRows(): Promise<AdminOpenUnmappedMarketDataRow[]> {
    try {
        const result = await queryPostgres<Record<string, unknown>>(
            `with mapping as (
                select
                    i.id as instrument_id,
                    bool_or(m.provider = 'yfinance' and m.is_active = true) as has_any_mapping,
                    bool_or(m.provider = 'yfinance' and m.is_active = true and m.is_primary = true) as has_primary_mapping,
                    bool_or(m.provider = 'yfinance' and m.is_active = true and m.verified_at is not null) as has_verified_mapping,
                    bool_or(m.provider = 'yfinance' and m.is_active = true and m.is_primary = true and m.verified_at is not null) as has_verified_primary,
                    bool_or(m.provider = 'yfinance' and m.notes ilike '%validated:yfinance; status=failed%') as has_failed_validation,
                    array_remove(array_agg(distinct case when m.provider = 'yfinance' then m.symbol end), null) as candidate_symbols,
                    max(case when m.provider = 'yfinance' and m.is_primary = true then m.symbol end) as primary_symbol
                from assets i
                left join asset_symbol_mappings m on m.instrument_id = i.id
                group by i.id
            ),
            price_flags as (
                select instrument_id, true as has_prices
                from (
                    select i.id as instrument_id
                    from assets i
                    join assets a
                      on a.asset_key_type = 'isin'
                     and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                    join asset_daily_prices p on p.asset_id = a.id
                    group by i.id
                ) rows
            ),
            action_flags as (
                select asset_id as instrument_id, true as has_actions
                from (
                    select asset_id from dividend_events
                    union
                    select asset_id from corporate_action_events
                ) actions
                group by asset_id
            )
            select
                i.isin,
                i.display_name,
                i.asset_type,
                i.currency,
                i.wkn,
                i.market_data_status,
                i.market_data_status_reason,
                coalesce(m.has_any_mapping, false) as has_any_mapping,
                coalesce(m.has_primary_mapping, false) as has_primary_mapping,
                coalesce(m.has_verified_mapping, false) as has_verified_mapping,
                coalesce(m.has_verified_primary, false) as has_verified_primary,
                coalesce(m.has_failed_validation, false) as has_failed_validation,
                coalesce(p.has_prices, false) as has_price_data,
                coalesce(a.has_actions, false) as has_market_actions,
                m.primary_symbol,
                coalesce(m.candidate_symbols, '{}'::text[]) as candidate_symbols
            from assets i
            left join mapping m on m.instrument_id = i.id
            left join price_flags p on p.instrument_id = i.id
            left join action_flags a on a.instrument_id = i.id
            where (
                coalesce(m.has_verified_primary, false) = false
                or coalesce(m.has_primary_mapping, false) = false
                or coalesce(m.has_failed_validation, false) = true
                or (coalesce(m.has_primary_mapping, false) = true and coalesce(p.has_prices, false) = false)
                or coalesce(i.market_data_status, '') in ('excluded', 'legacy', 'derivative', 'unknown')
            )
            order by i.isin asc`,
        );

        return result.rows.map((row) => ({
            isin: String(row.isin),
            displayName: row.display_name === null ? null : String(row.display_name),
            assetType: row.asset_type === null ? null : String(row.asset_type),
            currency: row.currency === null ? null : String(row.currency),
            wkn: row.wkn === null ? null : String(row.wkn),
            marketDataStatus: row.market_data_status === null ? null : normalizeInstrumentStatus(String(row.market_data_status)),
            marketDataStatusReason: row.market_data_status_reason === null ? null : String(row.market_data_status_reason),
            hasAnyMapping: Boolean(row.has_any_mapping),
            hasPrimaryMapping: Boolean(row.has_primary_mapping),
            hasVerifiedMapping: Boolean(row.has_verified_mapping),
            hasVerifiedPrimary: Boolean(row.has_verified_primary),
            hasFailedValidation: Boolean(row.has_failed_validation),
            hasPriceData: Boolean(row.has_price_data),
            hasMarketActions: Boolean(row.has_market_actions),
            primarySymbol: row.primary_symbol === null ? null : String(row.primary_symbol),
            candidateSymbols: Array.isArray(row.candidate_symbols)
                ? row.candidate_symbols.filter((value): value is string => typeof value === "string")
                : [],
        }));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listAdminMarketInstrumentOverviewRows(): Promise<AdminMarketInstrumentOverviewRow[]> {
    try {
        const result = await queryPostgres<Record<string, unknown>>(
            `with mapping as (
                select
                    i.id as instrument_id,
                    count(*) filter (where m.provider = 'yfinance' and m.is_active = true and m.verified_at is not null)::int as verified_mapping_count,
                    count(*) filter (where m.provider = 'yfinance' and m.is_active = true and m.verified_at is null)::int as candidate_mapping_count,
                    bool_or(m.provider = 'yfinance' and m.is_active = true and m.is_primary = true) as has_primary_mapping,
                    max(case when m.provider = 'yfinance' and m.is_active = true and m.is_primary = true then m.symbol end) as primary_symbol,
                    max(case when m.provider = 'yfinance' and m.is_active = true and m.is_primary = true then m.exchange end) as primary_exchange,
                    max(case when m.provider = 'yfinance' and m.is_active = true and m.is_primary = true then m.currency end) as primary_currency
                from assets i
                left join asset_symbol_mappings m on m.instrument_id = i.id
                group by i.id
            ),
            prices as (
                select
                    i.id as instrument_id,
                    true as has_prices,
                    min(p.price_date)::date as first_price_date,
                    max(p.price_date)::date as last_price_date
                from assets i
                join assets a
                  on a.asset_key_type = 'isin'
                 and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                join asset_daily_prices p on p.asset_id = a.id
                group by i.id
            ),
            latest_prices as (
                select distinct on (i.id)
                    i.id as instrument_id,
                    p.close_price as latest_close
                from assets i
                join assets a
                  on a.asset_key_type = 'isin'
                 and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                join asset_daily_prices p on p.asset_id = a.id
                order by i.id, p.price_date desc, p.updated_at desc
            ),
            actions as (
                select asset_id as instrument_id, true as has_actions
                from (
                    select asset_id from dividend_events
                    union
                    select asset_id from corporate_action_events
                ) actions
                group by asset_id
            )
            select
                i.isin,
                i.display_name,
                i.name,
                i.asset_type,
                i.currency,
                i.wkn,
                i.metadata_source,
                i.market_data_status,
                i.market_data_status_reason,
                m.primary_symbol,
                m.primary_exchange,
                m.primary_currency,
                coalesce(m.verified_mapping_count, 0) as verified_mapping_count,
                coalesce(m.candidate_mapping_count, 0) as candidate_mapping_count,
                coalesce(m.has_primary_mapping, false) as has_primary_mapping,
                coalesce(p.has_prices, false) as has_price_data,
                coalesce(ac.has_actions, false) as has_market_actions,
                p.first_price_date,
                p.last_price_date,
                lp.latest_close
            from assets i
            left join mapping m on m.instrument_id = i.id
            left join prices p on p.instrument_id = i.id
            left join latest_prices lp on lp.instrument_id = i.id
            left join actions ac on ac.instrument_id = i.id
            order by i.isin asc`,
        );

        return result.rows.map((row) => ({
            isin: String(row.isin),
            displayName: row.display_name === null ? null : String(row.display_name),
            name: row.name === null ? null : String(row.name),
            assetType: row.asset_type === null ? null : String(row.asset_type),
            currency: row.currency === null ? null : String(row.currency),
            wkn: row.wkn === null ? null : String(row.wkn),
            metadataSource: row.metadata_source === null ? null : String(row.metadata_source),
            marketDataStatus: row.market_data_status === null ? null : normalizeInstrumentStatus(String(row.market_data_status)),
            marketDataStatusReason: row.market_data_status_reason === null ? null : String(row.market_data_status_reason),
            primarySymbol: row.primary_symbol === null ? null : String(row.primary_symbol),
            primaryExchange: row.primary_exchange === null ? null : String(row.primary_exchange),
            primaryCurrency: row.primary_currency === null ? null : String(row.primary_currency),
            verifiedMappingCount: Number(row.verified_mapping_count ?? 0),
            candidateMappingCount: Number(row.candidate_mapping_count ?? 0),
            hasPrimaryMapping: Boolean(row.has_primary_mapping),
            hasPriceData: Boolean(row.has_price_data),
            hasMarketActions: Boolean(row.has_market_actions),
            firstPriceDate: row.first_price_date === null ? null : normalizeDbDateValue(row.first_price_date),
            lastPriceDate: row.last_price_date === null ? null : normalizeDbDateValue(row.last_price_date),
            latestClose: toNullableNumber(row.latest_close),
        }));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listAdminMarketSymbolMappingsOverviewRows(): Promise<AdminMarketSymbolMappingOverviewRow[]> {
    try {
        const result = await queryPostgres<Record<string, unknown>>(
            `with latest_price as (
                select distinct on (m.instrument_id, m.provider, m.symbol)
                    m.instrument_id,
                    m.provider,
                    m.symbol,
                    p.price_date as latest_price_date,
                    p.close_price as latest_close
                from asset_symbol_mappings m
                join assets i on i.id = m.instrument_id
                join assets a
                  on a.asset_key_type = 'isin'
                 and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                join asset_daily_prices p
                  on p.asset_id = a.id
                 and p.provider = m.provider
                order by m.instrument_id, m.provider, m.symbol, p.price_date desc, p.updated_at desc
            )
            select
                m.id,
                i.isin,
                i.display_name,
                m.provider,
                m.symbol,
                m.exchange,
                m.currency,
                m.notes,
                m.is_primary,
                m.is_active,
                m.verified_at,
                (lp.latest_price_date is not null) as has_price_data,
                lp.latest_price_date,
                lp.latest_close
            from asset_symbol_mappings m
            join assets i on i.id = m.instrument_id
            left join latest_price lp
              on lp.instrument_id = m.instrument_id
             and lp.provider = m.provider
             and lp.symbol = m.symbol
            order by i.isin asc, m.provider asc, m.symbol asc`,
        );

        return result.rows.map((row) => ({
            id: String(row.id),
            isin: String(row.isin),
            displayName: row.display_name === null ? null : String(row.display_name),
            provider: String(row.provider),
            symbol: String(row.symbol),
            exchange: row.exchange === null ? null : String(row.exchange),
            currency: row.currency === null ? null : String(row.currency),
            notes: row.notes === null ? null : String(row.notes),
            isPrimary: Boolean(row.is_primary),
            isActive: Boolean(row.is_active),
            verifiedAt: row.verified_at === null ? null : String(row.verified_at),
            hasPriceData: Boolean(row.has_price_data),
            latestPriceDate: row.latest_price_date === null ? null : normalizeDbDateValue(row.latest_price_date),
            latestClose: toNullableNumber(row.latest_close),
        }));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listAdminMarketDataRunOverviewRows(): Promise<AdminMarketDataRunOverviewRow[]> {
    try {
        const result = await queryPostgres<Record<string, unknown>>(
            `with run_item_counts as (
                select
                    ri.run_id,
                    count(*)::int as total_items,
                    count(*) filter (where lower(ri.status) in ('success', 'ok', 'completed'))::int as succeeded_items,
                    count(*) filter (where lower(ri.status) in ('failed', 'error'))::int as failed_items,
                    count(*) filter (where lower(ri.status) = 'skipped')::int as skipped_items,
                    count(*) filter (where ri.error_message is not null and btrim(ri.error_message) <> '')::int as error_count
                from reference_data_import_run_items ri
                group by ri.run_id
            ),
            latest_item_error as (
                select distinct on (ri.run_id)
                    ri.run_id,
                    ri.error_message
                from reference_data_import_run_items ri
                where ri.error_message is not null and btrim(ri.error_message) <> ''
                order by ri.run_id, ri.id desc
            )
            select
                r.id,
                r.run_type,
                r.status,
                r.provider,
                r.started_at,
                r.finished_at,
                case
                    when r.finished_at is null then null
                    else greatest(0, (extract(epoch from (r.finished_at - r.started_at)) * 1000)::bigint)
                end as duration_ms,
                coalesce(c.total_items, 0) as total_items,
                coalesce(c.succeeded_items, 0) as succeeded_items,
                coalesce(c.failed_items, 0) as failed_items,
                coalesce(c.skipped_items, 0) as skipped_items,
                coalesce(c.error_count, 0) as error_count,
                coalesce(e.error_message, r.error_message) as latest_error_message
            from reference_data_import_runs r
            left join run_item_counts c on c.run_id = r.id
            left join latest_item_error e on e.run_id = r.id
            order by r.started_at desc nulls last, r.id desc`,
        );

        return result.rows.map((row) => ({
            id: String(row.id),
            runType: String(row.run_type),
            status: String(row.status),
            provider: row.provider === null ? null : String(row.provider),
            startedAt: row.started_at === null ? null : String(row.started_at),
            finishedAt: row.finished_at === null ? null : String(row.finished_at),
            durationMs: toNullableNumber(row.duration_ms),
            totalItems: Number(row.total_items ?? 0),
            succeededItems: Number(row.succeeded_items ?? 0),
            failedItems: Number(row.failed_items ?? 0),
            skippedItems: Number(row.skipped_items ?? 0),
            errorCount: Number(row.error_count ?? 0),
            latestErrorMessage: row.latest_error_message === null ? null : String(row.latest_error_message),
        }));
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
             from asset_symbol_mappings m
             join assets i on i.id = m.instrument_id
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

export async function storeVerifiedSymbolMappingCandidate(
    input: StoreVerifiedSymbolMappingCandidateInput,
): Promise<StoreVerifiedSymbolMappingCandidateResult> {
    try {
        const instrumentId = String(input.instrumentId ?? "").trim();
        const provider = input.provider.trim().toLowerCase();
        const symbol = input.symbol.trim().toUpperCase();
        const noteSuffix = normalizeNonEmptyText(input.notes);

        if (!instrumentId || !provider || !symbol) {
            throw new MarketDataRepositoryError("invalid_input", "Instrument-ID, Provider oder Symbol fehlt.");
        }

        const existing = await queryPostgres<Record<string, unknown>>(
            `select
                m.id,
                coalesce(m.asset_id, m.instrument_id) as owner_asset_id,
                i.isin as owner_isin,
                coalesce(i.display_name, i.name) as owner_display_name,
                m.verified_at,
                m.notes
             from asset_symbol_mappings m
             join assets i
               on i.id = coalesce(m.asset_id, m.instrument_id)
             where m.provider = $1
               and coalesce(m.symbol, m.provider_symbol) = $2
             order by
                case when coalesce(m.asset_id, m.instrument_id) = $3 then 0 else 1 end,
                m.verified_at desc nulls last,
                m.created_at desc
             limit 5`,
            [provider, symbol, instrumentId],
        );

        const conflictingOwner = existing.rows.find((row) => String(row.owner_asset_id) !== instrumentId) ?? null;
        if (conflictingOwner) {
            return {
                status: "skipped_existing_other_asset",
                reason: "symbol_conflict_other_asset",
                mappingId: null,
                verifiedAt: null,
                conflictAssetId: String(conflictingOwner.owner_asset_id),
                conflictIsin: conflictingOwner.owner_isin === null ? null : String(conflictingOwner.owner_isin),
                conflictDisplayName:
                    conflictingOwner.owner_display_name === null ? null : String(conflictingOwner.owner_display_name),
            };
        }

        const ownedExisting = existing.rows.find((row) => String(row.owner_asset_id) === instrumentId) ?? null;

        if (ownedExisting) {
            if (ownedExisting.verified_at) {
                return {
                    status: "already_verified",
                    reason: "existing_verified_mapping",
                    mappingId: String(ownedExisting.id),
                    verifiedAt: String(ownedExisting.verified_at),
                };
            }

            const mergedNotes =
                noteSuffix == null
                    ? null
                    : ownedExisting.notes == null
                        ? noteSuffix
                        : `${String(ownedExisting.notes)} | ${noteSuffix}`.slice(0, 2000);
            const updated = await updateSymbolMappingById({
                id: String(ownedExisting.id),
                exchange: input.exchange ?? null,
                currency: input.currency ?? null,
                isActive: true,
                verifiedAt: new Date().toISOString(),
                notes: mergedNotes,
            });

            if (!updated?.verifiedAt) {
                throw new MarketDataRepositoryError("db_error", "Verifiziertes Mapping konnte nicht aktualisiert werden.");
            }

            return {
                status: "written_verified",
                reason: "existing_mapping_verified",
                mappingId: updated.id,
                verifiedAt: updated.verifiedAt,
            };
        }

        const inserted = await insertManualSymbolMapping({
            instrumentId,
            provider,
            symbol,
            exchange: input.exchange ?? null,
            currency: input.currency ?? null,
            isPrimary: false,
            isActive: true,
            verifiedAt: new Date().toISOString(),
            notes: noteSuffix,
        });

        if (inserted?.verifiedAt) {
            return {
                status: "written_verified",
                reason: "inserted_verified_mapping",
                mappingId: inserted.id,
                verifiedAt: inserted.verifiedAt,
            };
        }

        const fallbackOwner = await queryPostgres<Record<string, unknown>>(
            `select
                m.id,
                coalesce(m.asset_id, m.instrument_id) as owner_asset_id,
                i.isin as owner_isin,
                coalesce(i.display_name, i.name) as owner_display_name,
                m.verified_at
             from asset_symbol_mappings m
             join assets i
               on i.id = coalesce(m.asset_id, m.instrument_id)
             where m.provider = $1
               and coalesce(m.symbol, m.provider_symbol) = $2
             limit 1`,
            [provider, symbol],
        );
        const fallback = fallbackOwner.rows[0] ?? null;

        if (fallback && String(fallback.owner_asset_id) !== instrumentId) {
            return {
                status: "skipped_existing_other_asset",
                reason: "symbol_conflict_other_asset",
                mappingId: null,
                verifiedAt: null,
                conflictAssetId: String(fallback.owner_asset_id),
                conflictIsin: fallback.owner_isin === null ? null : String(fallback.owner_isin),
                conflictDisplayName: fallback.owner_display_name === null ? null : String(fallback.owner_display_name),
            };
        }

        if (fallback?.verified_at) {
            return {
                status: "already_verified",
                reason: "existing_verified_mapping",
                mappingId: String(fallback.id),
                verifiedAt: String(fallback.verified_at),
            };
        }

        throw new MarketDataRepositoryError("db_error", "Verifiziertes Mapping konnte nicht erstellt werden.");
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listSymbolMappingsForPrimaryPreference(
    provider = "yfinance",
    isin?: string,
): Promise<SymbolMappingForPrimaryPreference[]> {
    try {
        const normalizedProvider = provider.trim().toLowerCase();
        const normalizedIsin = isin ? assertIsin(isin) : null;
        const result = await queryPostgres<Record<string, unknown>>(
            `with provider_prices as (
                select
                    p.asset_id,
                    p.provider,
                    count(*)::int as provider_price_row_count,
                    max(p.price_date) as provider_latest_price_date
                from asset_daily_prices p
                where p.provider = $1
                group by p.asset_id, p.provider
            )
            select
                a.id as asset_id,
                a.isin,
                coalesce(a.display_name, a.name) as display_name,
                a.market_data_status,
                m.id as mapping_id,
                m.provider,
                coalesce(m.symbol, m.provider_symbol) as symbol,
                m.exchange,
                m.currency,
                m.is_primary,
                m.is_active,
                m.verified_at,
                m.notes,
                coalesce(pp.provider_price_row_count, 0) as provider_price_row_count,
                pp.provider_latest_price_date
             from asset_symbol_mappings m
             join assets a on a.id = coalesce(m.asset_id, m.instrument_id)
             left join provider_prices pp
               on pp.asset_id = coalesce(m.asset_id, m.instrument_id)
              and pp.provider = m.provider
             where m.provider = $1
               and m.is_active = true
               and a.asset_key_type = 'isin'
               and a.isin is not null
               and ($2::text is null or a.isin = $2)
             order by a.isin asc, m.is_primary desc, coalesce(m.symbol, m.provider_symbol) asc`,
            [normalizedProvider, normalizedIsin],
        );

        return result.rows.map((row) => ({
            assetId: String(row.asset_id),
            isin: String(row.isin),
            displayName: row.display_name === null ? null : String(row.display_name),
            marketDataStatus:
                row.market_data_status === null
                    ? null
                    : (String(row.market_data_status).toLowerCase() as MarketDataInstrumentStatus),
            mappingId: String(row.mapping_id),
            provider: String(row.provider),
            symbol: String(row.symbol),
            exchange: row.exchange === null ? null : String(row.exchange),
            currency: row.currency === null ? null : String(row.currency),
            isPrimary: Boolean(row.is_primary),
            isActive: Boolean(row.is_active),
            verifiedAt: row.verified_at === null ? null : String(row.verified_at),
            notes: row.notes === null ? null : String(row.notes),
            providerPriceRowCount: Number(row.provider_price_row_count ?? 0),
            providerLatestPriceDate:
                row.provider_latest_price_date === null ? null : normalizeDbDateValue(row.provider_latest_price_date),
        }));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function listPrimaryMappingPriceQuality(
    provider = "yfinance",
    isin?: string,
): Promise<PrimaryMappingPriceQualityRow[]> {
    try {
        const normalizedProvider = provider.trim().toLowerCase();
        const normalizedIsin = isin ? assertIsin(isin) : null;
        const result = await queryPostgres<Record<string, unknown>>(
            `with primary_mappings as (
                select
                    a.id as asset_id,
                    a.isin,
                    coalesce(a.display_name, a.name) as display_name,
                    a.market_data_status,
                    m.provider,
                    coalesce(m.symbol, m.provider_symbol) as primary_symbol,
                    m.exchange as primary_exchange,
                    m.currency as primary_currency
                from asset_symbol_mappings m
                join assets a on a.id = coalesce(m.asset_id, m.instrument_id)
                where m.provider = $1
                  and m.is_active = true
                  and m.is_primary = true
                  and a.asset_key_type = 'isin'
                  and a.isin is not null
                  and ($2::text is null or a.isin = $2)
            ),
            price_rows as (
                select
                    pm.asset_id,
                    pm.provider,
                    p.price_date,
                    p.currency,
                    lag(p.price_date) over (partition by pm.asset_id, pm.provider order by p.price_date) as previous_price_date
                from primary_mappings pm
                left join asset_daily_prices p
                  on p.asset_id = pm.asset_id
                 and p.provider = pm.provider
            ),
            currency_counts as (
                select
                    asset_id,
                    provider,
                    currency,
                    count(*)::int as row_count
                from price_rows
                where price_date is not null
                  and currency is not null
                group by asset_id, provider, currency
            ),
            price_stats_base as (
                select
                    asset_id,
                    provider,
                    count(price_date)::int as price_row_count,
                    min(price_date) as min_price_date,
                    max(price_date) as latest_price_date,
                    (
                        array_agg(currency order by price_date desc)
                        filter (where price_date is not null and currency is not null)
                    )[1] as latest_currency,
                    coalesce(max((price_date - previous_price_date)), 0)::int as longest_gap_days
                from price_rows
                group by asset_id, provider
            ),
            price_currency_stats as (
                select
                    asset_id,
                    provider,
                    coalesce(
                        array_agg(distinct cc.currency) filter (where cc.currency is not null),
                        array[]::text[]
                    ) as distinct_historical_currencies,
                    coalesce(
                        jsonb_object_agg(cc.currency, cc.row_count) filter (where cc.currency is not null),
                        '{}'::jsonb
                    ) as price_currency_breakdown,
                    coalesce(sum(case when cc.currency is not null and upper(cc.currency) <> 'EUR' then cc.row_count else 0 end), 0)::int as non_eur_price_row_count
                from currency_counts cc
                group by asset_id, provider
            )
            select
                pm.asset_id,
                pm.isin,
                pm.display_name,
                pm.market_data_status,
                pm.provider,
                pm.primary_symbol,
                pm.primary_exchange,
                pm.primary_currency,
                coalesce(ps.price_row_count, 0) as price_row_count,
                ps.min_price_date,
                ps.latest_price_date,
                ps.latest_currency,
                coalesce(ps.longest_gap_days, 0) as longest_gap_days,
                coalesce(pcs.distinct_historical_currencies, array[]::text[]) as distinct_historical_currencies,
                coalesce(pcs.price_currency_breakdown, '{}'::jsonb) as price_currency_breakdown,
                coalesce(pcs.non_eur_price_row_count, 0) as non_eur_price_row_count
            from primary_mappings pm
            left join price_stats_base ps
              on ps.asset_id = pm.asset_id
             and ps.provider = pm.provider
            left join price_currency_stats pcs
              on pcs.asset_id = pm.asset_id
             and pcs.provider = pm.provider
            order by pm.isin asc`,
            [normalizedProvider, normalizedIsin],
        );

        return result.rows.map((row) => ({
            assetId: String(row.asset_id),
            isin: String(row.isin),
            displayName: row.display_name === null ? null : String(row.display_name),
            marketDataStatus:
                row.market_data_status === null
                    ? null
                    : (String(row.market_data_status).toLowerCase() as MarketDataInstrumentStatus),
            provider: String(row.provider),
            primarySymbol: String(row.primary_symbol),
            primaryExchange: row.primary_exchange === null ? null : String(row.primary_exchange),
            primaryCurrency: row.primary_currency === null ? null : String(row.primary_currency),
            priceRowCount: Number(row.price_row_count ?? 0),
            minPriceDate: row.min_price_date === null ? null : normalizeDbDateValue(row.min_price_date),
            latestPriceDate: row.latest_price_date === null ? null : normalizeDbDateValue(row.latest_price_date),
            latestCurrency: row.latest_currency === null ? null : String(row.latest_currency),
            longestGapDays: Number(row.longest_gap_days ?? 0),
            distinctHistoricalCurrencies: Array.isArray(row.distinct_historical_currencies)
                ? row.distinct_historical_currencies.map((value) => String(value))
                : [],
            priceCurrencyBreakdown: mapJsonObjectNumberRecord(row.price_currency_breakdown),
            nonEurPriceRowCount: Number(row.non_eur_price_row_count ?? 0),
        }));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function setPrimarySymbolMappingById(
    mappingId: string,
    provider: string,
    isin: string,
    noteSuffix?: string,
): Promise<void> {
    try {
        const normalizedMappingId = String(mappingId ?? "").trim();
        const normalizedIsin = assertIsin(isin);
        const normalizedProvider = provider.trim().toLowerCase();
        if (!normalizedMappingId || !normalizedProvider) {
            throw new MarketDataRepositoryError("invalid_input", "Mapping-ID oder Provider fehlt.");
        }

        await withPostgresClient(async (client) => {
            await client.query("begin");
            try {
                const targetResult = await client.query<Record<string, unknown>>(
                    `select
                        m.id,
                        coalesce(m.asset_id, m.instrument_id) as owner_asset_id,
                        a.isin,
                        m.provider,
                        m.is_active,
                        m.verified_at
                     from asset_symbol_mappings m
                     join assets a on a.id = coalesce(m.asset_id, m.instrument_id)
                     where m.id = $1
                       and m.provider = $2
                       and a.isin = $3
                     for update`,
                    [normalizedMappingId, normalizedProvider, normalizedIsin],
                );
                const target = targetResult.rows[0] ?? null;
                if (!target) {
                    throw new MarketDataRepositoryError("invalid_input", "Ziel-Mapping für ISIN/Provider nicht gefunden.");
                }
                if (target.is_active !== true) {
                    throw new MarketDataRepositoryError("invalid_input", "Ziel-Mapping ist nicht aktiv.");
                }
                if (!target.verified_at) {
                    throw new MarketDataRepositoryError("invalid_input", "Ziel-Mapping ist nicht verifiziert.");
                }

                await client.query(
                    `update asset_symbol_mappings m
                     set is_primary = false,
                         updated_at = now()
                     where coalesce(m.asset_id, m.instrument_id) = $1
                       and m.provider = $2`,
                    [String(target.owner_asset_id), normalizedProvider],
                );

                const setPrimaryResult = await client.query(
                    `update asset_symbol_mappings
                     set is_primary = true,
                         notes = case
                             when $2::text is null then notes
                             when notes is null then $2::text
                             else left(notes || ' | ' || $2::text, 2000)
                         end,
                         updated_at = now()
                     where id = $1`,
                    [normalizedMappingId, noteSuffix ?? null],
                );

                if ((setPrimaryResult.rowCount ?? 0) !== 1) {
                    throw new MarketDataRepositoryError("db_error", "Primäres Symbol-Mapping konnte nicht eindeutig gesetzt werden.");
                }

                const verifyPrimaryResult = await client.query<Record<string, unknown>>(
                    `select is_primary, verified_at
                     from asset_symbol_mappings
                     where id = $1`,
                    [normalizedMappingId],
                );
                if (verifyPrimaryResult.rows[0]?.is_primary !== true || !verifyPrimaryResult.rows[0]?.verified_at) {
                    throw new MarketDataRepositoryError("db_error", "Primär-Mapping-Verifikation fehlgeschlagen.");
                }

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

        const result = await queryPostgres<Record<string, unknown>>(
            `select m.id
             from asset_symbol_mappings m
             join assets a on a.id = coalesce(m.asset_id, m.instrument_id)
             where a.isin = $1
               and m.provider = $2
               and coalesce(m.symbol, m.provider_symbol) = $3
               and m.is_active = true
               and m.verified_at is not null
             order by m.updated_at desc, m.created_at desc
             limit 2`,
            [normalizedIsin, normalizedProvider, normalizedSymbol],
        );
        if ((result.rows?.length ?? 0) !== 1) {
            throw new MarketDataRepositoryError("db_error", "Primäres Symbol-Mapping konnte nicht eindeutig gesetzt werden.");
        }

        await setPrimarySymbolMappingById(String(result.rows[0].id), normalizedProvider, normalizedIsin, noteSuffix);
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function replacePrimaryMappingPriceHistory(
    input: ReplacePrimaryMappingPriceHistoryInput,
): Promise<{ deletedPriceRows: number; insertedPriceRows: number; latestPriceDate: string | null }> {
    try {
        if (input.replacementPoints.length === 0) {
            throw new MarketDataRepositoryError("invalid_input", "Ersatz-Historie fehlt.");
        }

        const normalizedIsin = assertIsin(input.isin);
        const normalizedProvider = input.provider.trim().toLowerCase();
        const normalizedTargetMappingId = input.targetMappingId.trim();

        if (!normalizedProvider || !normalizedTargetMappingId) {
            throw new MarketDataRepositoryError("invalid_input", "Provider oder Mapping-ID fehlt.");
        }

        return await withPostgresClient(async (client) => {
            await client.query("begin");
            try {
                const mappingResult = await client.query<Record<string, unknown>>(
                    `select
                        m.id,
                        coalesce(m.asset_id, m.instrument_id) as owner_asset_id,
                        m.provider,
                        coalesce(m.symbol, m.provider_symbol) as symbol,
                        m.currency,
                        a.isin
                     from asset_symbol_mappings m
                     join assets a on a.id = coalesce(m.asset_id, m.instrument_id)
                     where m.id = $1
                       and m.provider = $2
                       and a.isin = $3
                     for update`,
                    [normalizedTargetMappingId, normalizedProvider, normalizedIsin],
                );
                const targetMapping = mappingResult.rows[0];
                if (!targetMapping) {
                    throw new MarketDataRepositoryError("invalid_input", "Ziel-Mapping nicht gefunden.");
                }

                const canonicalAssetResult = await client.query<Record<string, unknown>>(
                    `select id
                     from assets
                     where asset_key_type = 'isin'
                       and asset_key_value = $1
                     for update`,
                    [normalizedIsin],
                );
                const canonicalAsset = canonicalAssetResult.rows[0];
                if (!canonicalAsset?.id) {
                    throw new MarketDataRepositoryError("db_error", "Kanonischer Preis-Asset für ISIN konnte nicht gefunden werden.");
                }

                const mappingOwnerAssetId = String(targetMapping.owner_asset_id);
                const priceAssetId = String(canonicalAsset.id);
                const latestReplacementDate = input.replacementPoints.reduce<string | null>((latest, point) => {
                    const normalizedDate = toDateString(point.date);
                    if (!latest || normalizedDate > latest) {
                        return normalizedDate;
                    }
                    return latest;
                }, null);

                await client.query(
                    `update asset_symbol_mappings
                     set is_primary = false,
                         updated_at = now()
                     where coalesce(asset_id, instrument_id) = $1
                       and provider = $2`,
                    [mappingOwnerAssetId, normalizedProvider],
                );

                const setPrimaryResult = await client.query(
                    `update asset_symbol_mappings
                     set is_primary = true,
                         notes = case
                             when $2::text is null then notes
                             when notes is null then $2::text
                             else left(notes || ' | ' || $2::text, 2000)
                         end,
                         updated_at = now()
                     where id = $1`,
                    [normalizedTargetMappingId, input.noteSuffix ?? null],
                );

                if ((setPrimaryResult.rowCount ?? 0) !== 1) {
                    throw new MarketDataRepositoryError("db_error", "Ziel-Mapping konnte nicht als primär markiert werden.");
                }

                const verifyPrimaryResult = await client.query<Record<string, unknown>>(
                    `select is_primary
                     from asset_symbol_mappings
                     where id = $1`,
                    [normalizedTargetMappingId],
                );
                if (verifyPrimaryResult.rows[0]?.is_primary !== true) {
                    throw new MarketDataRepositoryError("db_error", "Primär-Mapping-Verifikation fehlgeschlagen.");
                }

                const deleteResult = await client.query(
                    `delete from asset_daily_prices
                     where asset_id = $1
                       and provider = $2`,
                    [priceAssetId, normalizedProvider],
                );

                for (const point of input.replacementPoints) {
                    const close = Number(point.close);
                    if (!Number.isFinite(close)) {
                        throw new MarketDataRepositoryError("invalid_input", "Ersatz-Historie enthält ungültigen Schlusskurs.");
                    }

                    await client.query(
                        `insert into asset_daily_prices
                            (asset_id, provider, price_date, open_price, high_price, low_price, close_price, adjusted_close_price, volume, currency)
                         values
                            ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10)
                         on conflict (asset_id, provider, price_date)
                         do update set
                            open_price = excluded.open_price,
                            high_price = excluded.high_price,
                            low_price = excluded.low_price,
                            close_price = excluded.close_price,
                            adjusted_close_price = excluded.adjusted_close_price,
                            volume = excluded.volume,
                            currency = excluded.currency,
                            updated_at = now()`,
                        [
                            priceAssetId,
                            normalizedProvider,
                            toDateString(point.date),
                            toNullableNumber(point.open),
                            toNullableNumber(point.high),
                            toNullableNumber(point.low),
                            close,
                            toNullableNumber(point.adjClose),
                            toNullableNumber(point.volume),
                            point.currency ?? input.replacementCurrency ?? targetMapping.currency ?? null,
                        ],
                    );
                }

                const insertedCountResult = await client.query<Record<string, unknown>>(
                    `select count(*)::int as inserted_count
                     from asset_daily_prices
                     where asset_id = $1
                       and provider = $2`,
                    [priceAssetId, normalizedProvider],
                );
                const insertedCount = Number(insertedCountResult.rows[0]?.inserted_count ?? 0);
                if (insertedCount < input.replacementPoints.length) {
                    throw new MarketDataRepositoryError(
                        "db_error",
                        `Insert-/Delete-Verifikation fehlgeschlagen: erwartete mindestens ${input.replacementPoints.length} Preiszeilen, gefunden ${insertedCount}.`,
                    );
                }

                const latestResult = await client.query<Record<string, unknown>>(
                    `select max(price_date) as latest_price_date
                     from asset_daily_prices
                     where asset_id = $1
                       and provider = $2`,
                    [priceAssetId, normalizedProvider],
                );
                const latestPriceDate = latestResult.rows[0]?.latest_price_date;
                const normalizedLatestPriceDate = latestPriceDate === null ? null : normalizeDbDateValue(latestPriceDate);

                if (!normalizedLatestPriceDate) {
                    throw new MarketDataRepositoryError("db_error", "Latest-Price-Verifikation fehlgeschlagen: keine Preiszeilen für Asset/Provider gefunden.");
                }
                if (normalizedLatestPriceDate !== latestReplacementDate) {
                    throw new MarketDataRepositoryError(
                        "db_error",
                        `Latest-Price-Verifikation fehlgeschlagen: erwartetes Datum ${latestReplacementDate}, gefunden ${normalizedLatestPriceDate}.`,
                    );
                }

                await client.query("commit");

                return {
                    deletedPriceRows: deleteResult.rowCount ?? 0,
                    insertedPriceRows: input.replacementPoints.length,
                    latestPriceDate: normalizedLatestPriceDate,
                };
            } catch (error) {
                await client.query("rollback");
                throw error;
            }
        });
    } catch (error) {
        handleRepositoryError(error, "replacePrimaryMappingPriceHistory(asset_daily_prices)");
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
                    select 1
                    from assets a
                    join asset_daily_prices p on p.asset_id = a.id
                    where a.asset_key_type = 'isin'
                      and a.asset_key_value = upper(regexp_replace(i.isin, '\\s+', '', 'g'))
                ) as has_prices,
                exists (
                    select 1
                    from (
                        select asset_id from dividend_events
                        union
                        select asset_id from corporate_action_events
                    ) a
                    where a.asset_id = coalesce(m.asset_id, m.instrument_id)
                ) as has_actions,
                m.verified_at
             from asset_symbol_mappings m
             join assets i on i.id = coalesce(m.asset_id, m.instrument_id)
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

export async function deleteDailyPricesForPrimaryMappings(input: {
    provider: string;
    isin?: string;
}): Promise<{ deletedPriceRows: number }> {
    try {
        const normalizedProvider = input.provider.trim().toLowerCase();
        const normalizedIsin = input.isin ? assertIsin(input.isin) : null;
        const result = await queryPostgres(
            `delete from asset_daily_prices p
             using assets a
             where p.asset_id = a.id
               and p.provider = $1
               and a.asset_key_type = 'isin'
               and ($2::text is null or a.isin = $2)`,
            [normalizedProvider, normalizedIsin],
        );
        return {
            deletedPriceRows: result.rowCount ?? 0,
        };
    } catch (error) {
        handleRepositoryError(error, "deleteDailyPricesForPrimaryMappings(asset_daily_prices)");
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
            `insert into asset_symbol_mappings
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
            `update asset_symbol_mappings
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
            `select
                p.provider,
                coalesce(m.provider_symbol, '') as symbol,
                p.price_date,
                p.open_price,
                p.high_price,
                p.low_price,
                p.close_price,
                p.adjusted_close_price,
                p.volume,
                p.currency,
                p.provider as source,
                p.updated_at as imported_at
             from assets a
             join asset_daily_prices p on p.asset_id = a.id
             left join lateral (
                select provider_symbol
                from asset_symbol_mappings m
                where m.asset_id = a.id
                  and m.provider = p.provider
                  and m.is_active = true
                order by m.is_primary desc, m.verified_at desc nulls last, m.updated_at desc
                limit 1
             ) m on true
             where a.asset_key_type = 'isin'
               and a.asset_key_value = $1
               and ($2::text is null or p.provider = $2)
               and ($3::date is null or p.price_date >= $3::date)
               and ($4::date is null or p.price_date <= $4::date)
             order by p.price_date asc`,
            [normalizedIsin, input.provider ?? null, input.from ?? null, input.to ?? null],
        );
        return result.rows.map((row) => mapPriceRow(row));
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function getLatestDailyPriceDateByIsin(input: {
    isin: string;
    provider?: string;
}): Promise<string | null> {
    try {
        const normalizedIsin = assertIsin(input.isin);
        const result = await queryPostgres<Record<string, unknown>>(
            `select max(p.price_date) as latest_date
             from assets a
             join asset_daily_prices p on p.asset_id = a.id
             where a.asset_key_type = 'isin'
               and a.asset_key_value = $1
               and ($2::text is null or p.provider = $2)`,
            [normalizedIsin, input.provider ?? null],
        );
        const value = result.rows[0]?.latest_date;
        return value == null ? null : normalizeDbDateValue(value);
    } catch (error) {
        handleRepositoryError(error);
    }
}

export async function upsertDailyPrices(input: UpsertDailyPricesInput): Promise<{ upserted: number }> {
    try {
        if (input.points.length === 0) {
            return { upserted: 0 };
        }

        await upsertInstrument({ isin: input.isin, currency: input.currency ?? null });
        const normalizedIsin = assertIsin(input.isin);
        const provider = input.provider.trim().toLowerCase();
        const symbol = input.symbol.trim().toUpperCase();
        if (!provider || !symbol) {
            throw new MarketDataRepositoryError("invalid_input", "Provider oder Symbol fehlt.");
        }

        await withPostgresClient(async (client) => {
            await client.query("begin");
            try {
                const assetResult = await client.query<Record<string, unknown>>(
                    `insert into assets
                        (asset_key_type, asset_key_value, isin, currency)
                     values
                        ('isin', $1, $1, $2)
                     on conflict (asset_key_type, asset_key_value)
                     do update set
                        isin = excluded.isin,
                        currency = coalesce(excluded.currency, assets.currency),
                        updated_at = now()
                     returning id`,
                    [normalizedIsin, input.currency ?? null],
                );
                const assetId = String(assetResult.rows[0]?.id);

                await client.query(
                    `update asset_symbol_mappings
                     set asset_id = $1,
                         currency = coalesce($4, currency),
                         is_active = true,
                         updated_at = now()
                     where provider = $2
                       and provider_symbol = $3`,
                    [assetId, provider, symbol, input.currency ?? null],
                );
                await client.query(
                    `insert into asset_symbol_mappings
                        (asset_id, provider, provider_symbol, currency, is_primary, is_active)
                     select
                        $1,
                        $2,
                        $3,
                        $4,
                        not exists (
                            select 1
                            from asset_symbol_mappings
                            where asset_id = $1
                              and provider = $2
                              and is_primary = true
                              and is_active = true
                        ),
                        true
                     where not exists (
                        select 1
                        from asset_symbol_mappings
                        where provider = $2
                          and provider_symbol = $3
                     )`,
                    [assetId, provider, symbol, input.currency ?? null],
                );

                for (const point of input.points) {
                    const close = Number(point.close);
                    if (!Number.isFinite(close)) {
                        continue;
                    }
                    await client.query(
                        `insert into asset_daily_prices
                            (asset_id, provider, price_date, open_price, high_price, low_price, close_price, adjusted_close_price, volume, currency)
                         values
                            ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10)
                         on conflict (asset_id, provider, price_date)
                         do update set
                            open_price = excluded.open_price,
                            high_price = excluded.high_price,
                            low_price = excluded.low_price,
                            close_price = excluded.close_price,
                            adjusted_close_price = excluded.adjusted_close_price,
                            volume = excluded.volume,
                            currency = excluded.currency,
                            updated_at = now()`,
                        [
                            assetId,
                            provider,
                            toDateString(point.date),
                            toNullableNumber(point.open),
                            toNullableNumber(point.high),
                            toNullableNumber(point.low),
                            close,
                            toNullableNumber(point.adjClose),
                            toNullableNumber(point.volume),
                            point.currency ?? input.currency ?? null,
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
        handleRepositoryError(error, "upsertDailyPrices(asset_daily_prices)");
    }
}

export async function getMarketActionsByIsin(input: GetMarketActionsInput): Promise<DbMarketAction[]> {
    try {
        const normalizedIsin = assertIsin(input.isin);
        const result = await queryPostgres<Record<string, unknown>>(
            `select action_type, date, amount, ratio, currency, source, imported_at
             from (
                select
                    'dividend'::text as action_type,
                    coalesce(d.ex_date, d.pay_date, d.record_date, d.declaration_date) as date,
                    d.amount,
                    null::text as ratio,
                    d.currency,
                    d.provider as source,
                    d.created_at as imported_at
                from dividend_events d
                join assets i on i.id = d.asset_id
                where i.isin = $1
                  and ($2::text is null or d.provider = $2)
                  and ($3::date is null or coalesce(d.ex_date, d.pay_date, d.record_date, d.declaration_date) >= $3::date)
                  and ($4::date is null or coalesce(d.ex_date, d.pay_date, d.record_date, d.declaration_date) <= $4::date)
                union all
                select
                    c.action_type,
                    coalesce(c.effective_date, c.announced_date) as date,
                    c.cash_component as amount,
                    case
                        when c.ratio_from is not null and c.ratio_to is not null then c.ratio_from::text || ':' || c.ratio_to::text
                        else null
                    end as ratio,
                    c.currency,
                    c.provider as source,
                    c.created_at as imported_at
                from corporate_action_events c
                join assets i on i.id = c.asset_id
                where i.isin = $1
                  and ($2::text is null or c.provider = $2)
                  and ($3::date is null or coalesce(c.effective_date, c.announced_date) >= $3::date)
                  and ($4::date is null or coalesce(c.effective_date, c.announced_date) <= $4::date)
             ) actions
             order by date asc`,
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
                    const normalizedDate = toDateString(action.date);
                    const normalizedAmount = toNullableNumber(action.amount);
                    const normalizedCurrency = action.currency ?? null;

                    if (actionType === "dividend" || actionType === "capital_gain") {
                        await client.query(
                            `insert into dividend_events
                                (asset_id, provider, ex_date, pay_date, record_date, declaration_date, amount, currency, source_run_id, confidence)
                             values
                                ($1, $2, $3::date, null, null, null, $4, $5, null, null)
                             on conflict do nothing`,
                            [instrument.id, provider, normalizedDate, normalizedAmount, normalizedCurrency],
                        );
                        continue;
                    }

                    let ratioFrom: number | null = null;
                    let ratioTo: number | null = null;
                    if (typeof action.ratio === "string") {
                        const ratioParts = action.ratio
                            .split(/[:/]/)
                            .map((part) => part.trim())
                            .filter(Boolean)
                            .map((part) => Number(part));
                        if (ratioParts.length === 2 && ratioParts.every((part) => Number.isFinite(part))) {
                            ratioFrom = ratioParts[0];
                            ratioTo = ratioParts[1];
                        }
                    }

                    await client.query(
                        `insert into corporate_action_events
                            (asset_id, provider, action_type, effective_date, announced_date, ratio_from, ratio_to, cash_component, currency, source_run_id, confidence)
                         values
                            ($1, $2, $3, $4::date, null, $5, $6, $7, $8, null, null)
                         on conflict do nothing`,
                        [
                            instrument.id,
                            provider,
                            actionType,
                            normalizedDate,
                            ratioFrom,
                            ratioTo,
                            normalizedAmount,
                            normalizedCurrency,
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
        const provider = input.provider.trim().toLowerCase();
        const runType = input.runType.trim();
        const source = await ensureMarketDataRunSource({ provider, runType });
        const result = await queryPostgres<{ id: string }>(
            `insert into reference_data_import_runs
                (source_id, import_type, status, started_at, run_type, provider, requested_symbols)
             values
                ($1, $2, 'running', now(), $2, $3, $4)
             returning id`,
            [source.sourceId, runType, provider, input.requestedSymbols],
        );
        return { runId: result.rows[0].id };
    } catch (error) {
        handleRepositoryError(error, "createMarketDataRun(reference_data_import_runs)");
    }
}

export async function finishMarketDataRun(input: FinishMarketDataRunInput): Promise<void> {
    try {
        await queryPostgres(
            `update reference_data_import_runs
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
        handleRepositoryError(error, "finishMarketDataRun(reference_data_import_runs)");
    }
}

export async function addMarketDataRunItem(input: AddMarketDataRunItemInput): Promise<{ itemId: string }> {
    try {
        const result = await queryPostgres<{ id: string }>(
            `insert into reference_data_import_run_items
                (run_id, asset_id, provider_symbol, item_type, status, instrument_id, symbol, points_imported, actions_imported, first_date, last_date, error_message)
             values
                ($1, null, $2, $3, $4, $5, $6, $7, $8, $9::date, $10::date, $11)
             returning id`,
            [
                input.runId,
                input.symbol.trim().toUpperCase(),
                `market_data:${input.provider.trim().toLowerCase()}`,
                input.status.trim(),
                input.instrumentId ?? null,
                input.symbol.trim().toUpperCase(),
                input.pointsImported ?? 0,
                input.actionsImported ?? 0,
                input.firstDate ?? null,
                input.lastDate ?? null,
                input.errorMessage ?? null,
            ],
        );
        return { itemId: result.rows[0].id };
    } catch (error) {
        handleRepositoryError(error, "addMarketDataRunItem(reference_data_import_run_items)");
    }
}
