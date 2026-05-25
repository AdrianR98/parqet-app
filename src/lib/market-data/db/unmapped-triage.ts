import type { MarketDataInstrumentStatus } from "./types-core";

export type MappingStatus = "failed_validation" | "no_mapping" | "primary_without_prices" | "unverified_mapping" | "ready";

export type UnmappedTriageCategory =
    | "mapping_candidate_needed"
    | "manual_review"
    | "derivative_or_warrant"
    | "legacy_or_corporate_action"
    | "failed_or_excluded"
    | "no_mapping"
    | "unverified_mapping"
    | "ready";

export type UnmappedSuggestedAction =
    | "add_candidates"
    | "validate_candidates"
    | "import_manual_mapping"
    | "review_derivative_or_exclude"
    | "review_legacy_or_successor"
    | "review_failed_validation"
    | "inspect_instrument"
    | "backfill_primary"
    | "ready";

export type UnmappedTriageInput = {
    isin: string;
    displayName: string | null;
    assetType: string | null;
    wkn: string | null;
    marketDataStatus: MarketDataInstrumentStatus | null;
    marketDataStatusReason: string | null;
    hasAnyMapping: boolean;
    hasPrimaryMapping: boolean;
    hasVerifiedMapping: boolean;
    hasVerifiedPrimary: boolean;
    hasFailedValidation: boolean;
    hasPriceData: boolean;
    candidateSymbols: string[];
    primarySymbol: string | null;
};

export type UnmappedTriageResult = {
    mappingStatus: MappingStatus;
    category: UnmappedTriageCategory;
    suggestedAction: UnmappedSuggestedAction;
    triageHint: string | null;
    priority: number;
};

const DERIVATIVE_RE = /\b(warrant|discount warrant|knock-?out|turbo|zertifikat|certificate|optionsschein)\b/i;
const LEGACY_RE = /\b(old|alt|adr|sp adr|depository receipt|successor|royal dutch shell b)\b/i;
const PLAUSIBLE_EQUITY_FUND_RE = /\b(stock|equity|share|fund|fonds|etf|ucits)\b/i;
const FAILED_RE = /\b(fail|invalid|error|rejected|excluded)\b/i;
const UNKNOWN_RE = /^(unknown|n\/a|null|undefined|-)?$/i;

function normalizeText(value: string | null | undefined): string {
    return String(value ?? "").trim().toLowerCase();
}

function classifyMappingStatus(input: UnmappedTriageInput): MappingStatus {
    if (input.hasFailedValidation) return "failed_validation";
    if (!input.hasAnyMapping || !input.hasPrimaryMapping) return "no_mapping";
    if (!input.hasVerifiedMapping || !input.hasVerifiedPrimary) return "unverified_mapping";
    if (!input.hasPriceData) return "primary_without_prices";
    return "ready";
}

function likelyDerivative(input: UnmappedTriageInput): boolean {
    const text = `${input.displayName ?? ""} ${input.assetType ?? ""}`;
    return DERIVATIVE_RE.test(text) || /\b(derivative|warrant|certificate)\b/i.test(input.assetType ?? "");
}

function likelyLegacy(input: UnmappedTriageInput): boolean {
    const text = `${input.displayName ?? ""} ${input.marketDataStatusReason ?? ""}`;
    return LEGACY_RE.test(text);
}

function hasUnknownName(input: UnmappedTriageInput): boolean {
    const displayName = normalizeText(input.displayName);
    return !displayName || displayName === normalizeText(input.isin) || UNKNOWN_RE.test(displayName);
}

function plausibleMappingCandidate(input: UnmappedTriageInput): boolean {
    const text = `${input.displayName ?? ""} ${input.assetType ?? ""}`;
    return PLAUSIBLE_EQUITY_FUND_RE.test(text) || /^US/i.test(input.isin);
}

function classify(input: UnmappedTriageInput, mappingStatus: MappingStatus): Omit<UnmappedTriageResult, "mappingStatus" | "priority"> {
    const status = normalizeText(input.marketDataStatus);
    const reason = normalizeText(input.marketDataStatusReason);

    if (mappingStatus === "ready") {
        return { category: "ready", suggestedAction: "ready", triageHint: "Mapping is verified and has price data." };
    }
    if (mappingStatus === "failed_validation" || FAILED_RE.test(reason)) {
        return {
            category: "failed_or_excluded",
            suggestedAction: "review_failed_validation",
            triageHint: "Validation failed or was excluded; review the candidate and status reason.",
        };
    }
    if (status === "derivative" || likelyDerivative(input)) {
        return {
            category: "derivative_or_warrant",
            suggestedAction: "review_derivative_or_exclude",
            triageHint: "Looks like a derivative/warrant based on name, type, or status.",
        };
    }
    if (status === "legacy" || likelyLegacy(input)) {
        return {
            category: "legacy_or_corporate_action",
            suggestedAction: "review_legacy_or_successor",
            triageHint: "Likely legacy/corporate-action instrument; review successor mapping.",
        };
    }
    if (status === "excluded") {
        return {
            category: "failed_or_excluded",
            suggestedAction: "inspect_instrument",
            triageHint: "Instrument is marked excluded; inspect status reason before further mapping.",
        };
    }
    if (hasUnknownName(input) || status === "unknown") {
        return {
            category: "manual_review",
            suggestedAction: "inspect_instrument",
            triageHint: "Insufficient or unclear metadata; inspect instrument details manually.",
        };
    }
    if (mappingStatus === "primary_without_prices") {
        return {
            category: "unverified_mapping",
            suggestedAction: "backfill_primary",
            triageHint: "Primary mapping exists and is verified; backfill prices/actions.",
        };
    }
    if (mappingStatus === "unverified_mapping") {
        return {
            category: "unverified_mapping",
            suggestedAction: "validate_candidates",
            triageHint: "Candidate mapping exists but is not verified yet.",
        };
    }
    if (mappingStatus === "no_mapping") {
        if (plausibleMappingCandidate(input)) {
            return {
                category: "mapping_candidate_needed",
                suggestedAction: "add_candidates",
                triageHint: "No mapping exists yet; add or import candidate symbols.",
            };
        }
        return {
            category: "no_mapping",
            suggestedAction: input.candidateSymbols.length > 0 ? "validate_candidates" : "import_manual_mapping",
            triageHint: "No mapping exists; add candidates or import a manual mapping.",
        };
    }

    return {
        category: "manual_review",
        suggestedAction: "inspect_instrument",
        triageHint: null,
    };
}

function computePriority(input: UnmappedTriageInput, result: Omit<UnmappedTriageResult, "priority">): number {
    let priority = 10;

    if (result.mappingStatus === "failed_validation") priority += 50;
    if (result.mappingStatus === "no_mapping") priority += 40;
    if (result.mappingStatus === "primary_without_prices") priority += 35;
    if (result.mappingStatus === "unverified_mapping") priority += 25;
    if (result.category === "mapping_candidate_needed") priority += 10;
    if (result.category === "manual_review") priority += 8;
    if (input.candidateSymbols.length === 0) priority += 5;
    if (!input.wkn) priority += 2;

    return priority;
}

export function classifyUnmappedTriage(input: UnmappedTriageInput): UnmappedTriageResult {
    const mappingStatus = classifyMappingStatus(input);
    const classified = classify(input, mappingStatus);
    const prePriority = { mappingStatus, ...classified };
    return {
        ...prePriority,
        priority: computePriority(input, prePriority),
    };
}
