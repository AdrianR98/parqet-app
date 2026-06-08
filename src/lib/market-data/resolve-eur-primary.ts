import type {
    DbMarketInstrument,
    DbMarketReferenceInstrument,
    SymbolMappingForPrimaryPreference,
} from "./db/types-core";

export type EurPrimaryCandidateTier =
    | "de"
    | "german_eur_fallback"
    | "other_eur_fallback";

export type EurPrimaryResolutionStatus =
    | "already_eur_primary"
    | "auto_resolvable"
    | "manual_review"
    | "terminal_ignored";

export type EurPrimaryResolutionReason =
    | "already_eur_primary"
    | "verified_candidate_available"
    | "unverified_eur_primary"
    | "needs_validation"
    | "no_candidate"
    | "ambiguous_verified_candidates"
    | "symbol_owned_by_other_asset"
    | "terminal_status";

export type EurPrimaryCandidate = {
    symbol: string;
    exchange: string | null;
    currency: string | null;
    tier: EurPrimaryCandidateTier;
    verified: boolean;
    sourceType: "verified_mapping" | "existing_mapping" | "reference_symbol" | "xetra_mnemonic" | "manual_eur_candidate";
    sourceKey: string;
    mappingId: string | null;
    ownerAssetId: string | null;
    ownerIsin: string | null;
    ownerDisplayName: string | null;
    hasOwnershipConflict: boolean;
};

export type ManualEurSymbolCandidateEntry = {
    name?: string | null;
    manualReview?: boolean;
    manualReviewReason?: string | null;
    candidates: string[];
};

export type EurPrimaryResolutionItem = {
    assetId: string;
    isin: string;
    displayName: string | null;
    marketDataStatus: DbMarketInstrument["marketDataStatus"];
    currentPrimarySymbol: string;
    currentPrimaryExchange: string | null;
    currentPrimaryCurrency: string | null;
    status: EurPrimaryResolutionStatus;
    reason: EurPrimaryResolutionReason;
    selectedCandidate: EurPrimaryCandidate | null;
    candidateTier: EurPrimaryCandidateTier | null;
    verifiedCandidates: EurPrimaryCandidate[];
    proposalCandidates: EurPrimaryCandidate[];
    validationBlocked: boolean;
};

export type EurPrimaryResolutionPlan = {
    totalPrimaryMappingsInspected: number;
    currentEurPrimaries: number;
    currentNonEurPrimaries: number;
    autoResolvableCandidates: number;
    deCandidates: number;
    germanEurFallbackCandidates: number;
    otherEurFallbackCandidates: number;
    manualReviewCases: number;
    terminalIgnoredCases: number;
    items: EurPrimaryResolutionItem[];
};

const GERMAN_SUFFIXES = new Set([".DE", ".F", ".HM", ".BE", ".DU", ".HA", ".MU", ".SG"]);
const GERMAN_EXCHANGES = new Set([
    "XETRA",
    "FRA",
    "FRANKFURT",
    "BER",
    "BERLIN",
    "DUS",
    "DUSSELDORF",
    "HAM",
    "HAMBURG",
    "HAN",
    "HANNOVER",
    "MUN",
    "MUNICH",
    "MUC",
    "STU",
    "STUTTGART",
    "GETTEX",
    "TRADEGATE",
]);

function normalizeSymbol(value: string | null | undefined): string | null {
    const normalized = String(value ?? "").trim().toUpperCase();
    return normalized || null;
}

function normalizeCurrency(value: string | null | undefined): string | null {
    const normalized = String(value ?? "").trim().toUpperCase();
    return normalized || null;
}

function normalizeExchange(value: string | null | undefined): string | null {
    const normalized = String(value ?? "").trim().toUpperCase();
    return normalized || null;
}

function isTerminalStatus(status: DbMarketInstrument["marketDataStatus"]): boolean {
    return status === "excluded" || status === "legacy" || status === "derivative";
}

function isEurCurrency(value: string | null | undefined): boolean {
    return normalizeCurrency(value) === "EUR";
}

export function classifyEurCandidateTier(symbol: string, exchange?: string | null): EurPrimaryCandidateTier {
    const normalizedSymbol = normalizeSymbol(symbol) ?? "";
    const normalizedExchange = normalizeExchange(exchange);
    if (normalizedSymbol.endsWith(".DE") || normalizedExchange === "XETRA") {
        return "de";
    }

    const suffix = normalizedSymbol.includes(".")
        ? normalizedSymbol.slice(normalizedSymbol.lastIndexOf("."))
        : null;
    if ((suffix && GERMAN_SUFFIXES.has(suffix)) || (normalizedExchange && GERMAN_EXCHANGES.has(normalizedExchange))) {
        return "german_eur_fallback";
    }

    return "other_eur_fallback";
}

function tierPriority(tier: EurPrimaryCandidateTier): number {
    if (tier === "de") return 0;
    if (tier === "german_eur_fallback") return 1;
    return 2;
}

function pushCandidate(
    target: EurPrimaryCandidate[],
    candidate: EurPrimaryCandidate,
    seen: Set<string>,
): void {
    const key = `${candidate.symbol}|${candidate.exchange ?? ""}|${candidate.currency ?? ""}`;
    if (seen.has(key)) {
        return;
    }
    seen.add(key);
    target.push(candidate);
}

export function buildEurPrimaryResolutionPlan(input: {
    instruments: DbMarketInstrument[];
    mappings: SymbolMappingForPrimaryPreference[];
    referenceCandidatesByIsin?: Map<string, DbMarketReferenceInstrument[]>;
    manualCandidatesByIsin?: Map<string, ManualEurSymbolCandidateEntry>;
}): EurPrimaryResolutionPlan {
    const mappingsByIsin = new Map<string, SymbolMappingForPrimaryPreference[]>();
    for (const mapping of input.mappings) {
        const list = mappingsByIsin.get(mapping.isin) ?? [];
        list.push(mapping);
        mappingsByIsin.set(mapping.isin, list);
    }

    const ownershipBySymbol = new Map<string, SymbolMappingForPrimaryPreference[]>();
    for (const mapping of input.mappings) {
        const symbol = normalizeSymbol(mapping.symbol);
        if (!symbol) continue;
        const list = ownershipBySymbol.get(symbol) ?? [];
        list.push(mapping);
        ownershipBySymbol.set(symbol, list);
    }

    const items: EurPrimaryResolutionItem[] = [];
    let totalPrimaryMappingsInspected = 0;
    let currentEurPrimaries = 0;
    let currentNonEurPrimaries = 0;
    let autoResolvableCandidates = 0;
    let deCandidates = 0;
    let germanEurFallbackCandidates = 0;
    let otherEurFallbackCandidates = 0;
    let manualReviewCases = 0;
    let terminalIgnoredCases = 0;

    for (const instrument of input.instruments) {
        const mappings = mappingsByIsin.get(instrument.isin) ?? [];
        const currentPrimary = mappings.find((mapping) => mapping.isPrimary) ?? null;
        if (!currentPrimary) {
            continue;
        }

        totalPrimaryMappingsInspected += 1;
        const currentPrimaryCurrency = normalizeCurrency(currentPrimary.currency);
        const currentPrimaryVerified = Boolean(currentPrimary.verifiedAt);
        if (currentPrimaryCurrency === "EUR" && currentPrimaryVerified) {
            currentEurPrimaries += 1;
            items.push({
                assetId: instrument.id,
                isin: instrument.isin,
                displayName: instrument.displayName ?? instrument.name ?? null,
                marketDataStatus: instrument.marketDataStatus,
                currentPrimarySymbol: currentPrimary.symbol,
                currentPrimaryExchange: currentPrimary.exchange,
                currentPrimaryCurrency,
                status: "already_eur_primary",
                reason: "already_eur_primary",
                selectedCandidate: null,
                candidateTier: null,
                verifiedCandidates: [],
                proposalCandidates: [],
                validationBlocked: false,
            });
            continue;
        }

        if (currentPrimaryCurrency !== "EUR") {
            currentNonEurPrimaries += 1;
        }

        if (isTerminalStatus(instrument.marketDataStatus)) {
            terminalIgnoredCases += 1;
            items.push({
                assetId: instrument.id,
                isin: instrument.isin,
                displayName: instrument.displayName ?? instrument.name ?? null,
                marketDataStatus: instrument.marketDataStatus,
                currentPrimarySymbol: currentPrimary.symbol,
                currentPrimaryExchange: currentPrimary.exchange,
                currentPrimaryCurrency,
                status: "terminal_ignored",
                reason: "terminal_status",
                selectedCandidate: null,
                candidateTier: null,
                verifiedCandidates: [],
                proposalCandidates: [],
                validationBlocked: false,
            });
            continue;
        }

        const verifiedCandidates: EurPrimaryCandidate[] = [];
        const proposalCandidates: EurPrimaryCandidate[] = [];
        const verifiedSeen = new Set<string>();
        const proposalSeen = new Set<string>();
        const references = input.referenceCandidatesByIsin?.get(instrument.isin) ?? [];
        const manualEntry = input.manualCandidatesByIsin?.get(instrument.isin) ?? null;

        if (currentPrimaryCurrency === "EUR" && !currentPrimaryVerified) {
            const currentPrimarySymbol = normalizeSymbol(currentPrimary.symbol);
            const owners = currentPrimarySymbol
                ? (ownershipBySymbol.get(currentPrimarySymbol) ?? []).filter((owner) => owner.assetId !== instrument.id)
                : [];
            const owner = owners[0] ?? null;
            pushCandidate(
                proposalCandidates,
                {
                    symbol: currentPrimary.symbol,
                    exchange: currentPrimary.exchange,
                    currency: currentPrimaryCurrency,
                    tier: classifyEurCandidateTier(currentPrimary.symbol, currentPrimary.exchange),
                    verified: false,
                    sourceType: "existing_mapping",
                    sourceKey: "asset_symbol_mappings",
                    mappingId: currentPrimary.mappingId,
                    ownerAssetId: owner?.assetId ?? null,
                    ownerIsin: owner?.isin ?? null,
                    ownerDisplayName: owner?.displayName ?? null,
                    hasOwnershipConflict: owners.length > 0,
                },
                proposalSeen,
            );
        }

        for (const mapping of mappings) {
            if (!isEurCurrency(mapping.currency)) continue;
            const symbol = normalizeSymbol(mapping.symbol);
            if (!symbol || symbol === normalizeSymbol(currentPrimary.symbol)) continue;

            const owners = (ownershipBySymbol.get(symbol) ?? []).filter((owner) => owner.assetId !== instrument.id);
            const owner = owners[0] ?? null;
            const candidate: EurPrimaryCandidate = {
                symbol,
                exchange: mapping.exchange,
                currency: normalizeCurrency(mapping.currency),
                tier: classifyEurCandidateTier(symbol, mapping.exchange),
                verified: Boolean(mapping.verifiedAt),
                sourceType: mapping.verifiedAt ? "verified_mapping" : "existing_mapping",
                sourceKey: "asset_symbol_mappings",
                mappingId: mapping.mappingId,
                ownerAssetId: owner?.assetId ?? null,
                ownerIsin: owner?.isin ?? null,
                ownerDisplayName: owner?.displayName ?? null,
                hasOwnershipConflict: owners.length > 0,
            };

            if (candidate.verified) {
                pushCandidate(verifiedCandidates, candidate, verifiedSeen);
            } else {
                pushCandidate(proposalCandidates, candidate, proposalSeen);
            }
        }

        for (const reference of references) {
            const candidates: Array<{
                symbol: string;
                exchange: string | null;
                currency: string | null;
                sourceType: "reference_symbol" | "xetra_mnemonic";
            }> = [];
            const referenceSymbol = normalizeSymbol(reference.symbol);
            if (referenceSymbol && isEurCurrency(reference.currency)) {
                candidates.push({
                    symbol: referenceSymbol,
                    exchange: reference.exchange,
                    currency: normalizeCurrency(reference.currency),
                    sourceType: "reference_symbol",
                });
            }
            if (
                reference.sourceKey === "xetra_all_tradable_instruments"
                && reference.mnemonic
                && isEurCurrency(reference.currency)
            ) {
                candidates.push({
                    symbol: `${String(reference.mnemonic).trim().toUpperCase()}.DE`,
                    exchange: reference.exchange ?? "XETRA",
                    currency: normalizeCurrency(reference.currency),
                    sourceType: "xetra_mnemonic",
                });
            }

            for (const referenceCandidate of candidates) {
                if (referenceCandidate.symbol === normalizeSymbol(currentPrimary.symbol)) continue;
                const owners = (ownershipBySymbol.get(referenceCandidate.symbol) ?? []).filter((owner) => owner.assetId !== instrument.id);
                const owner = owners[0] ?? null;
                pushCandidate(
                    proposalCandidates,
                    {
                        symbol: referenceCandidate.symbol,
                        exchange: referenceCandidate.exchange,
                        currency: referenceCandidate.currency,
                        tier: classifyEurCandidateTier(referenceCandidate.symbol, referenceCandidate.exchange),
                        verified: false,
                        sourceType: referenceCandidate.sourceType,
                        sourceKey: reference.sourceKey,
                        mappingId: null,
                        ownerAssetId: owner?.assetId ?? null,
                        ownerIsin: owner?.isin ?? null,
                        ownerDisplayName: owner?.displayName ?? null,
                        hasOwnershipConflict: owners.length > 0,
                    },
                    proposalSeen,
                );
            }
        }

        if (manualEntry) {
            for (const rawSymbol of manualEntry.candidates) {
                const symbol = normalizeSymbol(rawSymbol);
                if (!symbol || symbol === normalizeSymbol(currentPrimary.symbol)) continue;
                const owners = (ownershipBySymbol.get(symbol) ?? []).filter((owner) => owner.assetId !== instrument.id);
                const owner = owners[0] ?? null;
                pushCandidate(
                    proposalCandidates,
                    {
                        symbol,
                        exchange: null,
                        currency: "EUR",
                        tier: classifyEurCandidateTier(symbol, null),
                        verified: false,
                        sourceType: "manual_eur_candidate",
                        sourceKey: "manual_eur_symbol_candidates",
                        mappingId: null,
                        ownerAssetId: owner?.assetId ?? null,
                        ownerIsin: owner?.isin ?? null,
                        ownerDisplayName: owner?.displayName ?? null,
                        hasOwnershipConflict: owners.length > 0,
                    },
                    proposalSeen,
                );
            }
        }

        const sortedVerifiedCandidates = [...verifiedCandidates].sort((left, right) => {
            const tierDiff = tierPriority(left.tier) - tierPriority(right.tier);
            if (tierDiff !== 0) return tierDiff;
            return left.symbol.localeCompare(right.symbol);
        });

        const topTier = sortedVerifiedCandidates[0]?.tier ?? null;
        const topTierVerifiedCandidates = topTier
            ? sortedVerifiedCandidates.filter((candidate) => candidate.tier === topTier)
            : [];
        const topTierUnconflicted = topTierVerifiedCandidates.filter((candidate) => !candidate.hasOwnershipConflict);

        let item: EurPrimaryResolutionItem;
        if (topTierUnconflicted.length === 1) {
            const selectedCandidate = topTierUnconflicted[0];
            autoResolvableCandidates += 1;
            if (selectedCandidate.tier === "de") deCandidates += 1;
            if (selectedCandidate.tier === "german_eur_fallback") germanEurFallbackCandidates += 1;
            if (selectedCandidate.tier === "other_eur_fallback") otherEurFallbackCandidates += 1;
            item = {
                assetId: instrument.id,
                isin: instrument.isin,
                displayName: instrument.displayName ?? instrument.name ?? null,
                marketDataStatus: instrument.marketDataStatus,
                currentPrimarySymbol: currentPrimary.symbol,
                currentPrimaryExchange: currentPrimary.exchange,
                currentPrimaryCurrency,
                status: "auto_resolvable",
                reason: "verified_candidate_available",
                selectedCandidate,
                candidateTier: selectedCandidate.tier,
                verifiedCandidates: sortedVerifiedCandidates,
                proposalCandidates,
                validationBlocked: false,
            };
        } else if (topTierVerifiedCandidates.length > 0 && topTierUnconflicted.length === 0) {
            manualReviewCases += 1;
            item = {
                assetId: instrument.id,
                isin: instrument.isin,
                displayName: instrument.displayName ?? instrument.name ?? null,
                marketDataStatus: instrument.marketDataStatus,
                currentPrimarySymbol: currentPrimary.symbol,
                currentPrimaryExchange: currentPrimary.exchange,
                currentPrimaryCurrency,
                status: "manual_review",
                reason: "symbol_owned_by_other_asset",
                selectedCandidate: topTierVerifiedCandidates[0] ?? null,
                candidateTier: topTier,
                verifiedCandidates: sortedVerifiedCandidates,
                proposalCandidates,
                validationBlocked: false,
            };
        } else if (topTierUnconflicted.length > 1) {
            manualReviewCases += 1;
            item = {
                assetId: instrument.id,
                isin: instrument.isin,
                displayName: instrument.displayName ?? instrument.name ?? null,
                marketDataStatus: instrument.marketDataStatus,
                currentPrimarySymbol: currentPrimary.symbol,
                currentPrimaryExchange: currentPrimary.exchange,
                currentPrimaryCurrency,
                status: "manual_review",
                reason: "ambiguous_verified_candidates",
                selectedCandidate: null,
                candidateTier: topTier,
                verifiedCandidates: sortedVerifiedCandidates,
                proposalCandidates,
                validationBlocked: false,
            };
        } else if (proposalCandidates.length > 0) {
            const sortedProposalCandidates = proposalCandidates.sort((left, right) => {
                const tierDiff = tierPriority(left.tier) - tierPriority(right.tier);
                if (tierDiff !== 0) return tierDiff;
                return left.symbol.localeCompare(right.symbol);
            });
            const proposalTopTier = sortedProposalCandidates[0]?.tier ?? null;
            const proposalTopTierRows = proposalTopTier
                ? sortedProposalCandidates.filter((candidate) => candidate.tier === proposalTopTier)
                : [];
            const proposalTopTierUnconflicted = proposalTopTierRows.filter((candidate) => !candidate.hasOwnershipConflict);

            manualReviewCases += 1;
            const validationBlocked = Boolean(manualEntry?.manualReview);
            const conflictOnly = proposalTopTierRows.length > 0 && proposalTopTierUnconflicted.length === 0;
            item = {
                assetId: instrument.id,
                isin: instrument.isin,
                displayName: instrument.displayName ?? instrument.name ?? null,
                marketDataStatus: instrument.marketDataStatus,
                currentPrimarySymbol: currentPrimary.symbol,
                currentPrimaryExchange: currentPrimary.exchange,
                currentPrimaryCurrency,
                status: "manual_review",
                reason: conflictOnly
                    ? "symbol_owned_by_other_asset"
                    : (
                        currentPrimaryCurrency === "EUR" && !currentPrimaryVerified
                            ? "unverified_eur_primary"
                            : (validationBlocked && sortedProposalCandidates.length === 0 ? "no_candidate" : "needs_validation")
                    ),
                selectedCandidate: (
                    proposalTopTierRows.length > 0
                    && (
                            conflictOnly
                            || (currentPrimaryCurrency === "EUR" && !currentPrimaryVerified)
                            || validationBlocked
                        )
                )
                    ? (proposalTopTierRows[0] ?? null)
                    : null,
                candidateTier: (
                    proposalTopTierRows.length > 0
                    && (
                            conflictOnly
                            || (currentPrimaryCurrency === "EUR" && !currentPrimaryVerified)
                            || validationBlocked
                        )
                )
                    ? proposalTopTier
                    : null,
                verifiedCandidates: sortedVerifiedCandidates,
                proposalCandidates: sortedProposalCandidates,
                validationBlocked,
            };
        } else {
            manualReviewCases += 1;
            item = {
                assetId: instrument.id,
                isin: instrument.isin,
                displayName: instrument.displayName ?? instrument.name ?? null,
                marketDataStatus: instrument.marketDataStatus,
                currentPrimarySymbol: currentPrimary.symbol,
                currentPrimaryExchange: currentPrimary.exchange,
                currentPrimaryCurrency,
                status: "manual_review",
                reason: "no_candidate",
                selectedCandidate: null,
                candidateTier: null,
                verifiedCandidates: sortedVerifiedCandidates,
                proposalCandidates: [],
                validationBlocked: Boolean(manualEntry?.manualReview),
            };
        }

        items.push(item);
    }

    return {
        totalPrimaryMappingsInspected,
        currentEurPrimaries,
        currentNonEurPrimaries,
        autoResolvableCandidates,
        deCandidates,
        germanEurFallbackCandidates,
        otherEurFallbackCandidates,
        manualReviewCases,
        terminalIgnoredCases,
        items,
    };
}
