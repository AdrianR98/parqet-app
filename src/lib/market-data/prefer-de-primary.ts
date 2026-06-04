import type {
    DbMarketInstrument,
    SymbolMappingForPrimaryPreference,
} from "./db/types-core";

export type DePrimarySwitchCandidate = {
    assetId: string;
    isin: string;
    displayName: string | null;
    marketDataStatus: DbMarketInstrument["marketDataStatus"];
    oldPrimarySymbol: string | null;
    oldPrimaryMappingId: string | null;
    oldPrimaryExchange: string | null;
    oldPrimaryCurrency: string | null;
    newPrimarySymbol: string;
    newPrimaryMappingId: string;
    newPrimaryExchange: string | null;
    newPrimaryCurrency: string | null;
    oldPriceRowCountToDelete: number;
    existingNewPriceRowCount: number | null;
    requiresFullHistoryReplacement: boolean;
    isCurrencyFix: boolean;
    isVenueOnlySwitch: boolean;
};

export type DePrimaryPreferencePlan = {
    totalAssetsInspected: number;
    alreadyPrimaryDe: number;
    switchCandidates: DePrimarySwitchCandidate[];
    noDeCandidate: number;
    skippedNonActionable: number;
    actionableUnknownInspected: number;
    assetsRequiringFullHistoryReplacement: number;
};

export function isGermanYfinanceSymbol(symbol: string): boolean {
    return symbol.trim().toUpperCase().endsWith(".DE");
}

function isNonActionableStatus(status: DbMarketInstrument["marketDataStatus"]): boolean {
    return status === "excluded" || status === "legacy" || status === "derivative";
}

function compareDeCandidates(
    left: SymbolMappingForPrimaryPreference,
    right: SymbolMappingForPrimaryPreference,
): number {
    const leftPrimary = left.isPrimary ? 1 : 0;
    const rightPrimary = right.isPrimary ? 1 : 0;
    if (rightPrimary !== leftPrimary) {
        return rightPrimary - leftPrimary;
    }

    const leftHasHistory = left.providerPriceRowCount > 0 ? 1 : 0;
    const rightHasHistory = right.providerPriceRowCount > 0 ? 1 : 0;
    if (rightHasHistory !== leftHasHistory) {
        return rightHasHistory - leftHasHistory;
    }

    const leftLatest = left.providerLatestPriceDate ?? "";
    const rightLatest = right.providerLatestPriceDate ?? "";
    if (rightLatest !== leftLatest) {
        return rightLatest.localeCompare(leftLatest);
    }

    return left.symbol.localeCompare(right.symbol);
}

function normalizeCurrency(value: string | null): string | null {
    const normalized = value?.trim().toUpperCase() ?? null;
    return normalized || null;
}

export function buildDePrimaryPreferencePlan(input: {
    instruments: DbMarketInstrument[];
    mappings: SymbolMappingForPrimaryPreference[];
}): DePrimaryPreferencePlan {
    const mappingsByIsin = new Map<string, SymbolMappingForPrimaryPreference[]>();
    for (const mapping of input.mappings) {
        const list = mappingsByIsin.get(mapping.isin) ?? [];
        list.push(mapping);
        mappingsByIsin.set(mapping.isin, list);
    }

    const switchCandidates: DePrimarySwitchCandidate[] = [];
    let alreadyPrimaryDe = 0;
    let noDeCandidate = 0;
    let skippedNonActionable = 0;
    let actionableUnknownInspected = 0;
    let assetsRequiringFullHistoryReplacement = 0;

    for (const instrument of input.instruments) {
        const isin = instrument.isin;
        const mappings = mappingsByIsin.get(isin) ?? [];

        if (isNonActionableStatus(instrument.marketDataStatus)) {
            skippedNonActionable += 1;
            continue;
        }

        if (instrument.marketDataStatus === "unknown") {
            actionableUnknownInspected += 1;
        }

        const verifiedDeCandidates = mappings
            .filter((mapping) => mapping.verifiedAt && isGermanYfinanceSymbol(mapping.symbol))
            .sort(compareDeCandidates);

        if (verifiedDeCandidates.length === 0) {
            noDeCandidate += 1;
            continue;
        }

        const selected = verifiedDeCandidates[0];
        const currentPrimary = mappings.find((mapping) => mapping.isPrimary) ?? null;

        if (currentPrimary && currentPrimary.mappingId === selected.mappingId && isGermanYfinanceSymbol(currentPrimary.symbol)) {
            alreadyPrimaryDe += 1;
            continue;
        }

        const tickerChanges =
            currentPrimary !== null &&
            currentPrimary.mappingId !== selected.mappingId &&
            currentPrimary.symbol !== selected.symbol;
        const requiresFullHistoryReplacement = tickerChanges;
        const oldPrimaryCurrency = normalizeCurrency(currentPrimary?.currency ?? null);
        const newPrimaryCurrency = normalizeCurrency(selected.currency);
        const isVenueOnlySwitch = oldPrimaryCurrency === "EUR" && newPrimaryCurrency === "EUR";
        const isCurrencyFix = newPrimaryCurrency === "EUR" && oldPrimaryCurrency !== "EUR";
        if (requiresFullHistoryReplacement) {
            assetsRequiringFullHistoryReplacement += 1;
        }

        switchCandidates.push({
            assetId: instrument.id,
            isin,
            displayName: instrument.displayName ?? instrument.name ?? null,
            marketDataStatus: instrument.marketDataStatus,
            oldPrimarySymbol: currentPrimary?.symbol ?? null,
            oldPrimaryMappingId: currentPrimary?.mappingId ?? null,
            oldPrimaryExchange: currentPrimary?.exchange ?? null,
            oldPrimaryCurrency: currentPrimary?.currency ?? null,
            newPrimarySymbol: selected.symbol,
            newPrimaryMappingId: selected.mappingId,
            newPrimaryExchange: selected.exchange,
            newPrimaryCurrency: selected.currency,
            oldPriceRowCountToDelete: requiresFullHistoryReplacement ? currentPrimary?.providerPriceRowCount ?? 0 : 0,
            existingNewPriceRowCount:
                currentPrimary?.mappingId === selected.mappingId ? selected.providerPriceRowCount : null,
            requiresFullHistoryReplacement,
            isCurrencyFix,
            isVenueOnlySwitch,
        });
    }

    return {
        totalAssetsInspected: input.instruments.length,
        alreadyPrimaryDe,
        switchCandidates,
        noDeCandidate,
        skippedNonActionable,
        actionableUnknownInspected,
        assetsRequiringFullHistoryReplacement,
    };
}
