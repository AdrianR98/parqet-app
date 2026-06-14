import { buildGlobalAssetsFromNormalizationResult } from "../../src/lib/parqet/global-assets/aggregate";
import type { GlobalAssetMarketPriceOverlaysByIsin } from "../../src/lib/parqet/global-assets/aggregate";
import { normalizeActivities } from "../../src/lib/parqet/global-assets/normalize";
import type {
  GlobalAssetAggregationResult,
  ParqetActivityWithPortfolioContext,
  ReconciliationWarning,
} from "../../src/lib/parqet/global-assets/types";

type SyntheticActivityInput = {
  activityId: string;
  type?: string;
  datetime?: string;
  isin?: string | null;
  shares?: number | string | null;
  quantity?: number | string | null;
  currency?: string | null;
  amount?: number | string | null;
  amountNet?: number | string | null;
  buyAmountNet?: number | string | null;
  fee?: number | string | null;
  tax?: number | string | null;
  price?: number | string | null;
  portfolioId?: string;
  portfolioName?: string;
  portfolioCurrency?: string | null;
  rawOverrides?: Record<string, unknown>;
};

function setIfDefined(record: Record<string, unknown>, key: string, value: unknown) {
  if (value !== undefined) {
    record[key] = value;
  }
}

export function createSyntheticActivity(input: SyntheticActivityInput): ParqetActivityWithPortfolioContext {
  const raw: Record<string, unknown> = {};

  setIfDefined(raw, "id", input.activityId);
  setIfDefined(raw, "type", input.type);
  setIfDefined(raw, "datetime", input.datetime);
  setIfDefined(raw, "shares", input.shares);
  setIfDefined(raw, "quantity", input.quantity);
  setIfDefined(raw, "currency", input.currency);
  setIfDefined(raw, "amount", input.amount);
  setIfDefined(raw, "amountNet", input.amountNet);
  setIfDefined(raw, "buyAmountNet", input.buyAmountNet);
  setIfDefined(raw, "fee", input.fee);
  setIfDefined(raw, "tax", input.tax);
  setIfDefined(raw, "price", input.price);

  if (input.isin !== undefined) {
    raw.isin = input.isin;
  }

  return {
    portfolioId: input.portfolioId ?? "portfolio_demo_1",
    portfolioName: input.portfolioName ?? "Portfolio Demo 1",
    portfolioCurrency: input.portfolioCurrency === undefined ? "EUR" : input.portfolioCurrency,
    raw: {
      ...raw,
      ...(input.rawOverrides ?? {}),
    },
  };
}

export function runGlobalAssetPipeline(activities: ParqetActivityWithPortfolioContext[]): {
  normalization: ReturnType<typeof normalizeActivities>;
  aggregation: GlobalAssetAggregationResult;
};
export function runGlobalAssetPipeline(
  activities: ParqetActivityWithPortfolioContext[],
  options?: {
    marketPriceOverlaysByIsin?: GlobalAssetMarketPriceOverlaysByIsin;
    reportingCurrency?: string | null;
  },
): {
  normalization: ReturnType<typeof normalizeActivities>;
  aggregation: GlobalAssetAggregationResult;
} {
  const normalization = normalizeActivities(activities);
  const aggregation = buildGlobalAssetsFromNormalizationResult(normalization, options);

  return {
    normalization,
    aggregation,
  };
}

export function warningCodes(warnings: ReconciliationWarning[]): string[] {
  return warnings.map((warning) => String(warning.code));
}
