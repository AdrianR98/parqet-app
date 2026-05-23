
export type DbMarketDataProvider = string;

export type DbMarketInstrument = {
    id: string;
    isin: string;
    name: string | null;
    assetType: string | null;
    currency: string | null;
    createdAt: string;
    updatedAt: string;
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
    assetType?: string | null;
    currency?: string | null;
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
