import type { GlobalAssetViewModel } from "../../types";
import type {
  ProductReadModelAssetRow,
  ProductReadModelAssets,
  ProductReadModelConfidence,
  ProductReadModelFreshnessState,
  ProductReadModelSourceScope,
  ProductReadModelSourceType,
  ProductReadModelScopeState,
} from "./product-read-model";
import type { BlockedMetric } from "./types";

export type CanonicalSafeFieldSurfaceId =
  | "dashboard"
  | "asset_table"
  | "asset_detail"
  | "reports";

export type CanonicalSafeFieldProductSource =
  | "global_asset_product"
  | "runtime_assets_fallback";

export type CanonicalSafeFieldSelectionReason =
  | "guard_disabled"
  | "product_read_model_missing"
  | "product_read_model_invalid"
  | "product_read_model_empty"
  | "product_read_model_not_fresh"
  | "product_read_model_scope_mismatch"
  | "product_read_model_ready";

export type CanonicalSafeFieldAffectedField =
  | "position_value"
  | "unrealized_pnl"
  | "remaining_cost_basis"
  | "avg_buy_price"
  | "net_shares"
  | "total_dividend_net";

export type CanonicalSafeFieldSelectionDiagnostics = {
  readModelId: string | null;
  runtimeFallbackAssetCount: number;
  productAssetCount: number;
  blockedMetricAssetCount: number;
  blockedMetricCount: number;
  sourceType: ProductReadModelSourceType | "none";
  sourceScope: ProductReadModelSourceScope | "none";
  freshnessState: ProductReadModelFreshnessState | "none";
  scopeState: ProductReadModelScopeState | "none";
  confidence: ProductReadModelConfidence | "none";
  providerRequestCount: number | null;
  warningCount: number;
};

export type CanonicalSafeFieldSelection = {
  surface: CanonicalSafeFieldSurfaceId;
  selectedSource: CanonicalSafeFieldProductSource;
  reason: CanonicalSafeFieldSelectionReason;
  blockedMetrics: BlockedMetric[];
  affectedFields: CanonicalSafeFieldAffectedField[];
  diagnostics: CanonicalSafeFieldSelectionDiagnostics;
};

export type SelectCanonicalSafeFieldSourceInput = {
  surface: CanonicalSafeFieldSurfaceId;
  /**
   * Already-loaded runtime assets used as runtime fallback data when the
   * Product Read Model is unavailable for canonical field selection.
   */
  runtimeFallbackAssets: GlobalAssetViewModel[];
  productReadModel?: unknown;
  guardEnabled: boolean;
};

export type GuardedSurfaceId = CanonicalSafeFieldSurfaceId;
export type GuardedProductSource = CanonicalSafeFieldProductSource;
export type GuardedSourceSelectionReason = CanonicalSafeFieldSelectionReason;
export type GuardedAffectedField = CanonicalSafeFieldAffectedField;
export type GuardedSourceSelectionDiagnostics = CanonicalSafeFieldSelectionDiagnostics;
export type GuardedSourceSelection = CanonicalSafeFieldSelection;
export type SelectGuardedSourceInput = SelectCanonicalSafeFieldSourceInput;

const DEFAULT_AFFECTED_FIELDS: CanonicalSafeFieldAffectedField[] = [
  "position_value",
  "unrealized_pnl",
  "remaining_cost_basis",
  "avg_buy_price",
  "net_shares",
  "total_dividend_net",
];

function uniqueBlockedMetrics(rows: ProductReadModelAssetRow[]): BlockedMetric[] {
  return Array.from(new Set(rows.flatMap((row) => row.blockedMetrics)));
}

function blockedMetricsToAffectedFields(metrics: BlockedMetric[]): CanonicalSafeFieldAffectedField[] {
  const affectedFields = new Set<CanonicalSafeFieldAffectedField>(DEFAULT_AFFECTED_FIELDS);

  for (const metric of metrics) {
    if (metric === "market_value") {
      affectedFields.add("position_value");
    }

    if (metric === "unrealized_pnl" || metric === "realized_gains") {
      affectedFields.add("unrealized_pnl");
    }

    if (metric === "cost_basis") {
      affectedFields.add("remaining_cost_basis");
      affectedFields.add("avg_buy_price");
    }

    if (metric === "position" || metric === "portfolio_breakdown") {
      affectedFields.add("net_shares");
    }

    if (metric === "dividends") {
      affectedFields.add("total_dividend_net");
    }
  }

  return Array.from(affectedFields);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isProductReadModelPortfolioBreakdown(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.portfolioId === "string" &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.blockedMetrics)
  );
}

function isProductReadModelAssetRow(value: unknown): value is ProductReadModelAssetRow {
  if (!isRecord(value) || !isRecord(value.identity) || !isRecord(value.display)) {
    return false;
  }

  return (
    typeof value.display.displayName === "string" &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.blockedMetrics) &&
    Array.isArray(value.portfolioBreakdown) &&
    value.portfolioBreakdown.every(isProductReadModelPortfolioBreakdown)
  );
}

export function readGlobalAssetProductReadModel(value: unknown): ProductReadModelAssets | null {
  if (!isRecord(value)) {
    return null;
  }

  const metadata = value.metadata;
  const summary = value.summary;

  if (
    !isRecord(metadata) ||
    !isRecord(summary) ||
    !Array.isArray(value.assets) ||
    !value.assets.every(isProductReadModelAssetRow)
  ) {
    return null;
  }

  if (
    typeof metadata.readModelId !== "string" ||
    typeof metadata.sourceType !== "string" ||
    typeof metadata.sourceScope !== "string" ||
    typeof metadata.freshnessState !== "string" ||
    typeof metadata.scopeState !== "string" ||
    typeof metadata.confidence !== "string"
  ) {
    return null;
  }

  return value as ProductReadModelAssets;
}

function isFreshEnoughForCanonicalSafeFieldSelection(state: ProductReadModelFreshnessState): boolean {
  return state === "fresh";
}

function isScopeCompatibleForCanonicalSafeFieldSelection(state: ProductReadModelScopeState): boolean {
  return state === "scope_match" || state === "scope_subset";
}

function buildDiagnostics(input: {
  runtimeFallbackAssets: GlobalAssetViewModel[];
  productReadModel: ProductReadModelAssets | null;
}): CanonicalSafeFieldSelectionDiagnostics {
  const productAssets = input.productReadModel?.assets ?? [];
  const blockedMetrics = uniqueBlockedMetrics(productAssets);
  const warningCount = productAssets.reduce((count, row) => count + row.warnings.length, 0);

  return {
    readModelId: input.productReadModel?.metadata.readModelId ?? null,
    runtimeFallbackAssetCount: input.runtimeFallbackAssets.length,
    productAssetCount: productAssets.length,
    blockedMetricAssetCount: productAssets.filter((row) => row.blockedMetrics.length > 0).length,
    blockedMetricCount: blockedMetrics.length,
    sourceType: input.productReadModel?.metadata.sourceType ?? "none",
    sourceScope: input.productReadModel?.metadata.sourceScope ?? "none",
    freshnessState: input.productReadModel?.metadata.freshnessState ?? "none",
    scopeState: input.productReadModel?.metadata.scopeState ?? "none",
    confidence: input.productReadModel?.metadata.confidence ?? "none",
    providerRequestCount: input.productReadModel?.metadata.providerRequestCount ?? null,
    warningCount,
  };
}

function buildUnavailableSelection(input: {
  surface: CanonicalSafeFieldSurfaceId;
  reason: Exclude<CanonicalSafeFieldSelectionReason, "product_read_model_ready">;
  blockedMetrics: BlockedMetric[];
  affectedFields: CanonicalSafeFieldAffectedField[];
  diagnostics: CanonicalSafeFieldSelectionDiagnostics;
}): CanonicalSafeFieldSelection {
  return {
    surface: input.surface,
    selectedSource: "runtime_assets_fallback",
    reason: input.reason,
    blockedMetrics: input.blockedMetrics,
    affectedFields: input.affectedFields,
    diagnostics: input.diagnostics,
  };
}

export function selectCanonicalSafeFieldProductSurfaceSource(
  input: SelectCanonicalSafeFieldSourceInput,
): CanonicalSafeFieldSelection {
  const productReadModel = readGlobalAssetProductReadModel(input.productReadModel);
  const diagnostics = buildDiagnostics({
    runtimeFallbackAssets: input.runtimeFallbackAssets,
    productReadModel,
  });
  const blockedMetrics = uniqueBlockedMetrics(productReadModel?.assets ?? []);
  const affectedFields = blockedMetricsToAffectedFields(blockedMetrics);

  if (!input.guardEnabled) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "guard_disabled",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  if (input.productReadModel == null) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "product_read_model_missing",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  if (!productReadModel) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "product_read_model_invalid",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  if (input.runtimeFallbackAssets.length > 0 && productReadModel.assets.length === 0) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "product_read_model_empty",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  if (!isFreshEnoughForCanonicalSafeFieldSelection(productReadModel.metadata.freshnessState)) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "product_read_model_not_fresh",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  if (!isScopeCompatibleForCanonicalSafeFieldSelection(productReadModel.metadata.scopeState)) {
    return buildUnavailableSelection({
      surface: input.surface,
      reason: "product_read_model_scope_mismatch",
      blockedMetrics,
      affectedFields,
      diagnostics,
    });
  }

  return {
    surface: input.surface,
    selectedSource: "global_asset_product",
    reason: "product_read_model_ready",
    blockedMetrics,
    affectedFields,
    diagnostics,
  };
}

export function selectGuardedProductSurfaceSource(
  input: SelectGuardedSourceInput,
): GuardedSourceSelection {
  return selectCanonicalSafeFieldProductSurfaceSource(input);
}
