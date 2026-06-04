import type {
    DbMarketInstrument,
    DbMarketReferenceInstrument,
    SymbolMappingForPrimaryPreference,
} from "./db/types-core";

export type DeCandidateDiscoveryAsset = {
    assetId: string;
    isin: string;
    wkn: string | null;
    displayName: string | null;
    marketDataStatus: DbMarketInstrument["marketDataStatus"];
    currentPrimarySymbol: string | null;
    currentPrimaryExchange: string | null;
    currentPrimaryCurrency: string | null;
    existingYfinanceMappings: SymbolMappingForPrimaryPreference[];
    referenceCandidates: DbMarketReferenceInstrument[];
};

export type DeCandidateProposal = {
    symbol: string;
    exchange: string | null;
    currency: string | null;
    sourceKey: string;
    sourceType: "reference_symbol" | "xetra_mnemonic" | "existing_mapping";
    verified: false;
};

export type DeCandidateDiscoveryItem = DeCandidateDiscoveryAsset & {
    proposals: DeCandidateProposal[];
    hasVerifiedDe: boolean;
};

export type DeCandidateDiscoveryPlan = {
    totalAssetsInspected: number;
    assetsAlreadyWithVerifiedDe: number;
    assetsMissingDe: number;
    skippedNonActionable: number;
    actionableUnknownInspected: number;
    candidateProposalsFromReferenceData: number;
    remainingWithoutDe: number;
    items: DeCandidateDiscoveryItem[];
};

export type DeCandidateValidationSnapshot = {
    isin: string | null;
    symbol: string;
    hasHistory: boolean;
    pointCount: number;
    lastDate: string | null;
    latestClose: number | null;
    currency: string | null;
    error: string | null;
};

export type DeCandidateValidationDecision = {
    status: "verified" | "rejected" | "ambiguous";
    reason: string;
};

export type DeCandidateWriteDecision = {
    action: "none" | "store_unverified" | "store_verified";
    reason: string;
};

export function isGermanYfinanceSymbol(symbol: string): boolean {
    return symbol.trim().toUpperCase().endsWith(".DE");
}

function isNonActionableStatus(status: DbMarketInstrument["marketDataStatus"]): boolean {
    return status === "excluded" || status === "legacy" || status === "derivative";
}

function proposalPriority(proposal: DeCandidateProposal): number {
    if (proposal.sourceType === "xetra_mnemonic") return 0;
    if (proposal.sourceType === "reference_symbol") return 1;
    return 2;
}

function pushProposal(
    proposals: DeCandidateProposal[],
    proposal: DeCandidateProposal,
    seen: Set<string>,
): void {
    const key = `${proposal.symbol}|${proposal.exchange ?? ""}|${proposal.currency ?? ""}`;
    if (seen.has(key)) {
        return;
    }
    seen.add(key);
    proposals.push(proposal);
}

export function deriveDeCandidateProposals(asset: DeCandidateDiscoveryAsset): DeCandidateProposal[] {
    const proposals: DeCandidateProposal[] = [];
    const seen = new Set<string>();

    for (const mapping of asset.existingYfinanceMappings) {
        if (!mapping.verifiedAt && isGermanYfinanceSymbol(mapping.symbol)) {
            pushProposal(
                proposals,
                {
                    symbol: mapping.symbol,
                    exchange: mapping.exchange,
                    currency: mapping.currency,
                    sourceKey: "asset_symbol_mappings",
                    sourceType: "existing_mapping",
                    verified: false,
                },
                seen,
            );
        }
    }

    for (const reference of asset.referenceCandidates) {
        if (reference.symbol && isGermanYfinanceSymbol(reference.symbol)) {
            pushProposal(
                proposals,
                {
                    symbol: reference.symbol,
                    exchange: reference.exchange,
                    currency: reference.currency,
                    sourceKey: reference.sourceKey,
                    sourceType: "reference_symbol",
                    verified: false,
                },
                seen,
            );
        }

        if (reference.sourceKey === "xetra_all_tradable_instruments" && reference.mnemonic) {
            pushProposal(
                proposals,
                {
                    symbol: `${reference.mnemonic}.DE`,
                    exchange: reference.exchange ?? "XETRA",
                    currency: reference.currency,
                    sourceKey: reference.sourceKey,
                    sourceType: "xetra_mnemonic",
                    verified: false,
                },
                seen,
            );
        }
    }

    proposals.sort((left, right) => {
        const priorityDiff = proposalPriority(left) - proposalPriority(right);
        if (priorityDiff !== 0) {
            return priorityDiff;
        }
        return left.symbol.localeCompare(right.symbol);
    });

    return proposals;
}

export function buildDeCandidateDiscoveryPlan(assets: DeCandidateDiscoveryAsset[]): DeCandidateDiscoveryPlan {
    const items: DeCandidateDiscoveryItem[] = [];
    let assetsAlreadyWithVerifiedDe = 0;
    let assetsMissingDe = 0;
    let skippedNonActionable = 0;
    let actionableUnknownInspected = 0;
    let candidateProposalsFromReferenceData = 0;

    for (const asset of assets) {
        if (isNonActionableStatus(asset.marketDataStatus)) {
            skippedNonActionable += 1;
            continue;
        }

        if (asset.marketDataStatus === "unknown") {
            actionableUnknownInspected += 1;
        }

        const hasVerifiedDe = asset.existingYfinanceMappings.some(
            (mapping) => Boolean(mapping.verifiedAt) && isGermanYfinanceSymbol(mapping.symbol),
        );

        if (hasVerifiedDe) {
            assetsAlreadyWithVerifiedDe += 1;
            items.push({
                ...asset,
                proposals: [],
                hasVerifiedDe,
            });
            continue;
        }

        const proposals = deriveDeCandidateProposals(asset);
        if (proposals.length > 0) {
            candidateProposalsFromReferenceData += 1;
        }

        assetsMissingDe += 1;
        items.push({
            ...asset,
            proposals,
            hasVerifiedDe,
        });
    }

    return {
        totalAssetsInspected: assets.length,
        assetsAlreadyWithVerifiedDe,
        assetsMissingDe,
        skippedNonActionable,
        actionableUnknownInspected,
        candidateProposalsFromReferenceData,
        remainingWithoutDe: assetsMissingDe,
        items,
    };
}

export function classifyDeCandidateValidation(
    input: DeCandidateValidationSnapshot,
    today = new Date(),
): DeCandidateValidationDecision {
    if (input.error) {
        return {
            status: "rejected",
            reason: "provider_error",
        };
    }

    if (!input.hasHistory || input.pointCount <= 0 || input.latestClose == null) {
        return {
            status: "rejected",
            reason: "missing_usable_history",
        };
    }

    const lastDate = input.lastDate ? new Date(`${input.lastDate}T00:00:00Z`) : null;
    const ageDays =
        lastDate && !Number.isNaN(lastDate.getTime())
            ? Math.floor((today.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000))
            : null;

    if (input.currency && input.currency.toUpperCase() !== "EUR") {
        return {
            status: "rejected",
            reason: "non_eur_currency",
        };
    }

    if (ageDays != null && ageDays > 14) {
        return {
            status: "ambiguous",
            reason: "stale_recent_prices",
        };
    }

    if (!input.currency) {
        return {
            status: "ambiguous",
            reason: "missing_currency",
        };
    }

    return {
        status: "verified",
        reason: "usable_recent_eur_history",
    };
}

export function decideDeCandidateWriteAction(input: {
    write: boolean;
    validate: boolean;
    validationDecision?: DeCandidateValidationDecision | null;
}): DeCandidateWriteDecision {
    if (!input.write) {
        return {
            action: "none",
            reason: "dry_run",
        };
    }

    if (!input.validate) {
        return {
            action: "store_unverified",
            reason: "write_without_validation",
        };
    }

    if (input.validationDecision?.status === "verified") {
        return {
            action: "store_verified",
            reason: "validated_verified",
        };
    }

    return {
        action: "none",
        reason: "validation_not_verified",
    };
}
