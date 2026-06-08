
export type DbMarketDataProvider = string;

export type AssetKeyType = "isin" | "wkn" | "provider_symbol" | "custom";

export type DbAsset = {
    id: string;
    assetKeyType: string;
    assetKeyValue: string;
    isin: string | null;
    wkn: string | null;
    displayName: string | null;
    assetType: string | null;
    currency: string | null;
    exchange: string | null;
    createdAt: string;
    updatedAt: string;
};

export type FindAssetInput =
    | { isin: string }
    | { assetKeyType: string; assetKeyValue: string };

export type AssetLatestMarketPriceSnapshot = {
    assetId: string;
    assetKeyType: string;
    assetKeyValue: string;
    isin: string | null;
    provider: string;
    priceAmount: number;
    currency: string | null;
    priceDate: string;
    priceTimestamp: string | null;
    updatedAt: string;
};

export type FindLatestMarketPriceByAssetKeyInput = {
    assetKeyType: string;
    assetKeyValue: string;
    provider?: string;
};

export type FindLatestMarketPricesByAssetKeysInput = {
    keys: Array<{ assetKeyType: string; assetKeyValue: string }>;
    provider?: string;
};

export type DbMarketInstrument = {
    id: string;
    isin: string;
    name: string | null;
    displayName: string | null;
    assetType: string | null;
    currency: string | null;
    wkn: string | null;
    metadataSource: string | null;
    metadataUpdatedAt: string | null;
    nameSource: string | null;
    displayNameSource: string | null;
    displayMetadataUpdatedAt: string | null;
    marketDataStatus: MarketDataInstrumentStatus | null;
    marketDataStatusReason: string | null;
    marketDataSuccessorIsin: string | null;
    marketDataSuccessorSymbol: string | null;
    marketDataStatusUpdatedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type DbMarketInstrumentMetadata = {
    isin: string;
    name: string | null;
    displayName: string | null;
    wkn: string | null;
    assetType: string | null;
    currency: string | null;
    metadataSource: string | null;
    metadataUpdatedAt: string | null;
    nameSource: string | null;
    displayNameSource: string | null;
    displayMetadataUpdatedAt: string | null;
    marketDataStatus: MarketDataInstrumentStatus | null;
    marketDataStatusReason: string | null;
    marketDataSuccessorIsin: string | null;
    marketDataSuccessorSymbol: string | null;
    marketDataStatusUpdatedAt: string | null;
};

export type MarketDataInstrumentStatus = "active" | "excluded" | "legacy" | "derivative" | "unknown";
export type MarketDataRequestStatus =
    | "pending"
    | "known_instrument"
    | "mapping_missing"
    | "import_ready"
    | "imported"
    | "failed"
    | "ignored";

export type UpdateMarketInstrumentStatusInput = {
    isin: string;
    status: MarketDataInstrumentStatus;
    reason?: string | null;
    successorIsin?: string | null;
    successorSymbol?: string | null;
};

export type UpdateMarketInstrumentMetadataInput = {
    isin: string;
    name?: string;
    displayName?: string;
    assetType?: string;
    currency?: string;
    wkn?: string;
    metadataSource?: string | null;
    nameSource?: string | null;
    displayNameSource?: string | null;
};

export type DbMarketSymbolMapping = {
    id: string;
    instrumentId: string;
    provider: string;
    symbol: string;
    exchange: string | null;
    currency: string | null;
    isPrimary: boolean;
    isActive: boolean;
    verifiedAt: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
};

export type DbPrimarySymbolMappingByIsin = {
    isin: string;
    mapping: DbMarketSymbolMapping;
};

export type DbMarketPricePoint = {
    provider: string;
    symbol: string;
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number;
    adjClose: number | null;
    volume: number | null;
    currency: string | null;
    source: string | null;
    importedAt: string;
};

export type DbMarketAction = {
    actionType: string;
    date: string;
    amount: number | null;
    ratio: string | null;
    currency: string | null;
    source: string | null;
    importedAt: string;
};

export type UpsertInstrumentInput = {
    isin: string;
    name?: string | null;
    displayName?: string | null;
    assetType?: string | null;
    currency?: string | null;
    wkn?: string | null;
    metadataSource?: string | null;
    nameSource?: string | null;
    displayNameSource?: string | null;
};

export type UpsertReferenceSourceInput = {
    sourceKey: string;
    displayName: string;
    sourceType: string;
    fileName?: string | null;
    rowCount?: number | null;
    notes?: string | null;
};

export type DbMarketReferenceSource = {
    id: string;
    sourceKey: string;
    displayName: string;
    sourceType: string;
    fileName: string | null;
    rowCount: number | null;
    importedAt: string;
    notes: string | null;
};

export type UpsertReferenceInstrumentInput = {
    sourceKey: string;
    isin: string;
    wkn?: string | null;
    name?: string | null;
    symbol?: string | null;
    mnemonic?: string | null;
    exchange?: string | null;
    micCode?: string | null;
    primaryMarketMicCode?: string | null;
    currency?: string | null;
    instrumentType?: string | null;
    productCategory?: string | null;
    marketSegment?: string | null;
    rawPayload?: Record<string, unknown> | null;
};

export type DbMarketReferenceInstrument = {
    id: string;
    sourceKey: string;
    isin: string | null;
    wkn: string | null;
    name: string | null;
    symbol: string | null;
    mnemonic: string | null;
    exchange: string | null;
    micCode: string | null;
    primaryMarketMicCode: string | null;
    currency: string | null;
    instrumentType: string | null;
    productCategory: string | null;
    marketSegment: string | null;
    rawPayload: Record<string, unknown> | null;
    importedAt: string;
};

export type EnrichMarketInstrumentsFromReferencesInput = {
    sourceKey?: string;
    isin?: string;
    limit?: number;
    forceName?: boolean;
};

export type EnrichMarketInstrumentsFromReferencesResult = {
    matched: number;
    updated: number;
    nameUpdates: number;
    wknUpdates: number;
    currencyUpdates: number;
    assetTypeUpdates: number;
};

export type EnrichMarketInstrumentsFromTradingUniverseInput = {
    sourceKey?: string;
    isin?: string;
    limit?: number;
    forceName?: boolean;
    setDisplayName?: boolean;
    forceDisplayName?: boolean;
};

export type EnrichMarketInstrumentsFromTradingUniverseResult = {
    matched: number;
    updated: number;
    nameUpdates: number;
    displayNameUpdates: number;
    skippedNoMatch: number;
    skippedExistingBetter: number;
};

export type TradingUniverseReferenceMatch = {
    isin: string;
    currentName: string | null;
    currentDisplayName: string | null;
    referenceName: string | null;
    plannedNameUpdate: boolean;
    plannedDisplayNameUpdate: boolean;
    existingBetter: boolean;
};

export type ReferenceSourceCount = {
    sourceKey: string;
    rowCount: number;
};

export type ListXetraReferenceCandidatesInput = {
    sourceKey?: string;
    isin?: string;
    limit?: number;
    excludeIsins?: string[];
    instrumentTypes?: string[];
    preferEtfs?: boolean;
};

export type DbXetraReferenceCandidate = {
    instrumentId: string;
    isin: string;
    name: string | null;
    candidateSymbol: string;
    mnemonic: string;
    currency: string | null;
    instrumentType: string | null;
    marketSegment: string | null;
    micCode: string | null;
    primaryMarketMicCode: string | null;
    hasVerifiedPrimary: boolean;
    hasVerifiedYfinance: boolean;
    hasAnyPrimary: boolean;
    hasExistingCandidate: boolean;
};

export type InsertSymbolMappingCandidateInput = {
    instrumentId: string;
    provider: string;
    symbol: string;
    exchange?: string | null;
    currency?: string | null;
    notes?: string | null;
};

export type InsertManualSymbolMappingInput = {
    instrumentId: string;
    provider: string;
    symbol: string;
    exchange?: string | null;
    currency?: string | null;
    isPrimary?: boolean;
    isActive?: boolean;
    verifiedAt?: string | null;
    notes?: string | null;
};

export type UpdateSymbolMappingByIdInput = {
    id: string;
    symbol?: string;
    exchange?: string | null;
    currency?: string | null;
    isPrimary?: boolean;
    isActive?: boolean;
    verifiedAt?: string | null;
    clearVerifiedAt?: boolean;
    notes?: string | null;
};

export type UpsertSymbolMappingInput = {
    isin: string;
    provider: string;
    symbol: string;
    exchange?: string | null;
    currency?: string | null;
    isPrimary?: boolean;
    isActive?: boolean;
    verifiedAt?: string | null;
    notes?: string | null;
};

export type GetDailyPricesInput = {
    isin: string;
    provider?: string;
    from?: string;
    to?: string;
};

export type ListMarketInstrumentsInput = {
    limit?: number;
};

export type UpsertDailyPricesInput = {
    isin: string;
    provider: string;
    symbol: string;
    currency?: string | null;
    source?: string | null;
    points: Array<{
        date: string;
        open?: number | null;
        high?: number | null;
        low?: number | null;
        close: number;
        adjClose?: number | null;
        volume?: number | null;
        currency?: string | null;
    }>;
};

export type GetMarketActionsInput = {
    isin: string;
    provider?: string;
    from?: string;
    to?: string;
};

export type UpsertMarketActionsInput = {
    isin: string;
    provider: string;
    symbol: string;
    source?: string | null;
    actions: Array<{
        actionType: string;
        date: string;
        amount?: number | null;
        ratio?: string | null;
        currency?: string | null;
    }>;
};

export type CreateMarketDataRunInput = {
    provider: string;
    runType: string;
    requestedSymbols: number;
};

export type FinishMarketDataRunInput = {
    runId: string;
    status: string;
    successfulSymbols: number;
    failedSymbols: number;
    errorMessage?: string | null;
};

export type AddMarketDataRunItemInput = {
    runId: string;
    instrumentId?: string | null;
    provider: string;
    symbol: string;
    status: string;
    pointsImported?: number;
    actionsImported?: number;
    firstDate?: string | null;
    lastDate?: string | null;
    errorMessage?: string | null;
};

export type ListUnverifiedSymbolMappingsInput = {
    provider?: string;
    limit?: number;
    isin?: string;
};

export type DbMarketSymbolMappingCandidate = {
    isin: string;
    name: string | null;
    provider: string;
    symbol: string;
    exchange: string | null;
    currency: string | null;
    isPrimary: boolean;
    isActive: boolean;
    verifiedAt: string | null;
    notes: string | null;
};

export type UpdateSymbolMappingValidationInput = {
    provider: string;
    symbol: string;
    verifiedAt?: string | null;
    notes?: string | null;
    isActive?: boolean;
};

export type ListIsinsWithVerifiedMappingsInput = {
    provider?: string;
};

export type MarketDataStatusSummary = {
    instrumentsTotal: number;
    mappingsTotal: number;
    yfinanceMappingsTotal: number;
    verifiedYfinanceMappings: number;
    primaryYfinanceMappings: number;
    instrumentsWithVerifiedYfinance: number;
    instrumentsWithoutAnyMapping: number;
    instrumentsWithMappingButNoVerifiedYfinance: number;
    instrumentsWithPrimaryYfinance: number;
    instrumentsWithoutPrimaryYfinance: number;
    instrumentsWithDailyPrices: number;
    instrumentsWithActions: number;
    instrumentsWithPrimaryButNoPrices: number;
    failedValidationCandidates: number;
    instrumentsStatusExcluded: number;
    instrumentsStatusLegacy: number;
    instrumentsStatusDerivative: number;
    instrumentsStatusUnknown: number;
};

export type MarketInstrumentStatusSummaryRow = {
    status: MarketDataInstrumentStatus | null;
    count: number;
};

export type AdminOpenUnmappedMarketDataRow = {
    isin: string;
    displayName: string | null;
    assetType: string | null;
    currency: string | null;
    wkn: string | null;
    marketDataStatus: MarketDataInstrumentStatus | null;
    marketDataStatusReason: string | null;
    hasAnyMapping: boolean;
    hasPrimaryMapping: boolean;
    hasVerifiedMapping: boolean;
    hasVerifiedPrimary: boolean;
    hasFailedValidation: boolean;
    hasPriceData: boolean;
    hasMarketActions: boolean;
    primarySymbol: string | null;
    candidateSymbols: string[];
};

export type AdminMarketInstrumentOverviewRow = {
    isin: string;
    displayName: string | null;
    name: string | null;
    assetType: string | null;
    currency: string | null;
    wkn: string | null;
    metadataSource: string | null;
    marketDataStatus: MarketDataInstrumentStatus | null;
    marketDataStatusReason: string | null;
    primarySymbol: string | null;
    primaryExchange: string | null;
    primaryCurrency: string | null;
    verifiedMappingCount: number;
    candidateMappingCount: number;
    hasPrimaryMapping: boolean;
    hasPriceData: boolean;
    hasMarketActions: boolean;
    firstPriceDate: string | null;
    lastPriceDate: string | null;
    latestClose: number | null;
};

export type AdminMarketSymbolMappingOverviewRow = {
    id: string;
    isin: string;
    displayName: string | null;
    provider: string;
    symbol: string;
    exchange: string | null;
    currency: string | null;
    notes: string | null;
    isPrimary: boolean;
    isActive: boolean;
    verifiedAt: string | null;
    hasPriceData: boolean;
    latestPriceDate: string | null;
    latestClose: number | null;
};

export type AdminMarketDataRunOverviewRow = {
    id: string;
    runType: string;
    status: string;
    provider: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    durationMs: number | null;
    totalItems: number;
    succeededItems: number;
    failedItems: number;
    skippedItems: number;
    errorCount: number;
    latestErrorMessage: string | null;
};

export type RecordMarketDataRequestInput = {
    isin: string;
    name?: string | null;
    displayName?: string | null;
    assetType?: string | null;
    currency?: string | null;
    wkn?: string | null;
    source?: string | null;
};

export type DbMarketDataRequest = {
    id: string;
    isin: string;
    name: string | null;
    displayName: string | null;
    assetType: string | null;
    currency: string | null;
    wkn: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    seenCount: number;
    status: MarketDataRequestStatus;
    source: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
};

export type ListMarketDataRequestsInput = {
    limit?: number;
    status?: string | null;
    source?: string | null;
    q?: string | null;
};

export type ListMarketDataRequestsResult = {
    total: number;
    items: DbMarketDataRequest[];
};

export type VerifiedMappingForPromotion = {
    isin: string;
    name: string | null;
    provider: string;
    symbol: string;
    exchange: string | null;
    currency: string | null;
    isPrimary: boolean;
    isActive: boolean;
    verifiedAt: string;
    notes: string | null;
};

export type SymbolMappingForPrimaryPreference = {
    assetId: string;
    isin: string;
    displayName: string | null;
    marketDataStatus: MarketDataInstrumentStatus | null;
    mappingId: string;
    provider: string;
    symbol: string;
    exchange: string | null;
    currency: string | null;
    isPrimary: boolean;
    isActive: boolean;
    verifiedAt: string | null;
    notes: string | null;
    providerPriceRowCount: number;
    providerLatestPriceDate: string | null;
};

export type PrimaryMappingForBackfill = {
    isin: string;
    name: string | null;
    provider: string;
    symbol: string;
    exchange: string | null;
    currency: string | null;
    hasPrices: boolean;
    hasActions: boolean;
    verifiedAt: string;
};

export type PrimaryMappingPriceQualityRow = {
    assetId: string;
    isin: string;
    displayName: string | null;
    marketDataStatus: MarketDataInstrumentStatus | null;
    provider: string;
    primarySymbol: string;
    primaryExchange: string | null;
    primaryCurrency: string | null;
    priceRowCount: number;
    minPriceDate: string | null;
    latestPriceDate: string | null;
    latestCurrency: string | null;
    longestGapDays: number;
    distinctHistoricalCurrencies: string[];
    priceCurrencyBreakdown: Record<string, number>;
    nonEurPriceRowCount: number;
};

export type ReplacePrimaryMappingPriceHistoryInput = {
    isin: string;
    provider: string;
    targetMappingId: string;
    noteSuffix?: string | null;
    replacementCurrency?: string | null;
    replacementPoints: Array<{
        date: string;
        open?: number | null;
        high?: number | null;
        low?: number | null;
        close: number;
        adjClose?: number | null;
        volume?: number | null;
        currency?: string | null;
    }>;
};

export type StoreVerifiedSymbolMappingCandidateInput = {
    instrumentId: string;
    provider: string;
    symbol: string;
    exchange?: string | null;
    currency?: string | null;
    notes?: string | null;
};

export type StoreVerifiedSymbolMappingCandidateResult = {
    status: "written_verified" | "already_verified" | "skipped_existing_other_asset";
    reason: string;
    mappingId: string | null;
    verifiedAt: string | null;
    conflictAssetId?: string | null;
    conflictIsin?: string | null;
    conflictDisplayName?: string | null;
};
