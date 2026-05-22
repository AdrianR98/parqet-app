import { loadDashboardCache, type DashboardCache } from "./dashboard-cache";
import { createAssetDetailHrefFromParts } from "./asset-detail";
import { formatCurrency, formatDateTime, formatMonth, formatShares } from "./format";
import { getMergedAssetMetadataCache } from "./asset-metadata";
import { normalizeIsin } from "./metadata-utils";
import {
  loadKnownPortfolios,
  loadPortfolioScope,
  type PortfolioScope,
} from "./app-settings";
import {
  selectActivitiesTimelinePrmFeatureFlagSource,
  type ActivitiesTimelinePrmFeatureFlagSelection,
  type ActivitiesTimelineShadowComparisonStatus,
  type ActivitiesTimelineShadowDiagnosticHarness,
  type ProductReadModelFreshnessState,
  type ProductReadModelScopeState,
  type ProductReadModelActivitiesTimeline,
} from "./parqet/global-assets/product-read-model";
import type {
  ActivitiesAuditItem,
  AuditActivityType,
  Portfolio,
  SnapshotFreshness,
} from "./types";

export type LocalActivitySource = "snapshot" | "local_derived" | "none";

export type LocalActivityReadModel = {
  items: ActivitiesAuditItem[];
  portfolios: Portfolio[];
  scopedPortfolioIds: string[];
  loadedPortfolioIds: string[];
  missingScopePortfolioIds: string[];
  scope: PortfolioScope;
  generatedAt: string | null;
  freshness: SnapshotFreshness | null;
  source: LocalActivitySource;
  activitiesTimelinePrmSelection: ActivitiesTimelinePrmFeatureFlagSelection;
};

export type ActivitySortKey = "date" | "asset" | "type" | "amount";
export type ActivitySortDirection = "asc" | "desc";

export type ActivityFilters = {
  portfolioIds: string[];
  query: string;
  exactIsin?: string;
  types: AuditActivityType[];
  dateFrom: string;
  dateTo: string;
  warningsOnly: boolean;
  overridesOnly: boolean;
};

export type ActivitySort = {
  key: ActivitySortKey;
  direction: ActivitySortDirection;
};

export type ProjectedActivity = {
  id: string;
  datetime: string;
  dateLabel: string;
  monthKey: string;
  monthLabel: string;
  year: number;
  type: AuditActivityType;
  typeLabel: string;
  assetLabel: string;
  assetMeta: string;
  assetHref: string | null;
  portfolioLabel: string;
  sharesLabel: string;
  priceLabel: string;
  amountLabel: string;
  amountNetLabel: string;
  feeLabel: string | null;
  taxLabel: string | null;
  noteLabel: string | null;
  warningMessages: string[];
  hasWarnings: boolean;
  hasOverrides: boolean;
  overrideLabel: string | null;
};

export type ActivityGroup = {
  key: string;
  label: string;
  items: ProjectedActivity[];
};

export type SelectLocalActivitiesTimelineSourceInput = {
  currentItems: ActivitiesAuditItem[];
  projected?: ProductReadModelActivitiesTimeline | null;
  featureFlagEnabled: boolean;
  diagnosticHarness?: ActivitiesTimelineShadowDiagnosticHarness | null;
  statusOverride?: ActivitiesTimelineShadowComparisonStatus;
};

export type SelectLocalActivitiesTimelineSourceOutput = {
  items: ActivitiesAuditItem[];
  selection: ActivitiesTimelinePrmFeatureFlagSelection;
};

export function normalizeExactIsin(value: string | null | undefined): string {
  return normalizeIsin(value ?? "");
}

function resolveActivitiesTimelinePrmFeatureFlagEnabled(): boolean {
  const rawValue = process.env.NEXT_PUBLIC_ACTIVITIES_TIMELINE_PRM_FEATURE_FLAG;

  if (!rawValue) {
    return true;
  }

  const normalizedValue = rawValue.trim().toLowerCase();

  if (normalizedValue === "0" || normalizedValue === "false" || normalizedValue === "off") {
    return false;
  }

  if (normalizedValue === "1" || normalizedValue === "true" || normalizedValue === "on") {
    return true;
  }

  return true;
}

function toAuditActivityType(type: string): AuditActivityType {
  switch (type) {
    case "buy":
    case "sell":
    case "dividend":
    case "transfer_in":
    case "transfer_out":
      return type;
    default:
      return "unknown";
  }
}

function toIsoMonthKey(datetime: string): string {
  const parsed = new Date(datetime);

  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

function toIsoMonthLabel(datetime: string): string {
  const parsed = new Date(datetime);

  if (Number.isNaN(parsed.getTime())) {
    return "Ohne Datum";
  }

  return formatMonth(parsed, "Ohne Datum");
}

function toProjectedActivityDateTime(
  datetime: string | null,
  date: string | null,
  fallbackGeneratedAt: string | null,
): string {
  if (datetime) {
    return datetime;
  }

  if (date) {
    return `${date}T00:00:00.000Z`;
  }

  if (fallbackGeneratedAt) {
    return fallbackGeneratedAt;
  }

  return "1970-01-01T00:00:00.000Z";
}

function mapProductReadModelItemsToActivitiesAuditItems(
  projected: ProductReadModelActivitiesTimeline,
  currentItems: ActivitiesAuditItem[],
): ActivitiesAuditItem[] {
  const currentItemsById = new Map(currentItems.map((item) => [item.id, item]));

  return projected.items.map((item, index) => {
    const currentItem = currentItemsById.get(item.activityId);

    if (currentItem) {
      return {
        ...currentItem,
      };
    }

    const datetime = toProjectedActivityDateTime(
      item.datetime,
      item.date,
      projected.metadata.generatedAt,
    );
    const monthKey = toIsoMonthKey(datetime);
    const parsedDate = new Date(datetime);

    return {
      id: item.activityId || `prm-activity-${index + 1}`,
      datetime,
      year: Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getFullYear(),
      monthKey,
      monthLabel: toIsoMonthLabel(datetime),
      portfolioId: item.portfolioId ?? null,
      portfolioName: item.portfolioId ?? "Kein Portfolio-Kontext",
      isin: item.assetKey?.type === "isin" ? item.assetKey.value : "",
      name: item.assetKey ? `${item.assetKey.type}:${item.assetKey.value}` : null,
      symbol: null,
      wkn: item.assetKey?.type === "wkn" ? item.assetKey.value : null,
      type: toAuditActivityType(item.activityType),
      rawType: item.activityType,
      shares: 0,
      price: 0,
      amount: 0,
      amountNet: 0,
      warningMessages: item.warnings.map((warning) => warning.code),
      hasOverrides: false,
      overrideCount: 0,
      overrideFlags: {},
      overrideValues: null,
    };
  });
}

function mapActivitiesAuditItemsToSelectorInput(items: ActivitiesAuditItem[]) {
  return items.map((item) => ({
    type: item.type,
    warningMessages: item.warningMessages ?? [],
    hasOverrides: item.hasOverrides,
    overrideCount: item.overrideCount ?? 0,
    overrideFlags: item.overrideFlags ?? {},
    blockedMetrics: [],
    isBlocked: false,
  }));
}

function resolveLocalPrmFreshnessState(
  freshness: SnapshotFreshness | null | undefined,
): ProductReadModelFreshnessState | null {
  if (!freshness || freshness.status === "missing" || freshness.source === "none") {
    return null;
  }

  if (freshness.stale || freshness.status === "stale" || freshness.status === "refresh_failed") {
    return "stale";
  }

  if (freshness.status === "fresh") {
    return "fresh";
  }

  return null;
}

function resolveLocalPrmScopeState(
  scope: PortfolioScope,
  loadedPortfolioIds: string[],
): ProductReadModelScopeState {
  if (scope.mode !== "manual") {
    return loadedPortfolioIds.length > 0 ? "scope_match" : "scope_unknown";
  }

  const selectedPortfolioIds = unique(scope.selectedPortfolioIds);

  if (selectedPortfolioIds.length === 0) {
    return "scope_unknown";
  }

  if (loadedPortfolioIds.length === 0) {
    return "scope_missing";
  }

  const loadedPortfolioIdSet = new Set(loadedPortfolioIds);
  return selectedPortfolioIds.every((id) => loadedPortfolioIdSet.has(id))
    ? "scope_match"
    : "scope_missing";
}

function toLocalPrmActivityType(
  type: AuditActivityType,
): ProductReadModelActivitiesTimeline["items"][number]["activityType"] {
  switch (type) {
    case "buy":
    case "sell":
    case "dividend":
    case "transfer_in":
    case "transfer_out":
      return type;
    default:
      return "unknown";
  }
}

function toLocalPrmAssetKey(
  item: ActivitiesAuditItem,
): ProductReadModelActivitiesTimeline["items"][number]["assetKey"] {
  const normalizedIsin = item.isin.trim();

  if (normalizedIsin) {
    return {
      type: "isin",
      value: normalizedIsin,
    };
  }

  const normalizedWkn = item.wkn?.trim();

  if (normalizedWkn) {
    return {
      type: "wkn",
      value: normalizedWkn,
    };
  }

  return null;
}

export function buildLocalActivitiesTimelinePrmProjection(
  cache: DashboardCache | null,
  scope: PortfolioScope,
): ProductReadModelActivitiesTimeline | null {
  if (!cache) {
    return null;
  }

  const currentItems = cache.activityItems ?? [];

  if (currentItems.length === 0) {
    return null;
  }

  const freshnessState = resolveLocalPrmFreshnessState(cache.freshness);

  if (!freshnessState) {
    return null;
  }

  const generatedAt =
    cache.lastUpdatedAt ?? cache.generatedAt ?? cache.freshness?.updatedAt ?? cache.freshness?.loadedAt;

  if (!generatedAt) {
    return null;
  }

  const itemPortfolioIds = unique(
    currentItems.flatMap((item) => (item.portfolioId ? [item.portfolioId] : [])),
  );
  const loadedPortfolioIds = unique([...(cache.selectedPortfolioIds ?? []), ...itemPortfolioIds]);
  const selectedPortfolioIds =
    scope.mode === "manual" ? unique(scope.selectedPortfolioIds) : loadedPortfolioIds;
  const scopeState = resolveLocalPrmScopeState(scope, loadedPortfolioIds);
  const metadataWarnings: ProductReadModelActivitiesTimeline["metadata"]["warnings"] = [];

  if (freshnessState === "stale") {
    metadataWarnings.push({
      code: "LOCAL_ACTIVITY_TIMELINE_STALE",
      severity: "Warning",
      source: "local_projection",
      blockedMetrics: [],
    });
  }

  if (scopeState === "scope_missing" || scopeState === "scope_unknown") {
    metadataWarnings.push({
      code: "LOCAL_ACTIVITY_TIMELINE_SCOPE_MISMATCH",
      severity: "Warning",
      source: "local_projection",
      blockedMetrics: [],
    });
  }

  const valueClassificationCounts = {
    provider_reference: 0,
    app_calculated: 0,
    estimated: 0,
    preliminary: 0,
    blocked: 0,
    none: 0,
  } as ProductReadModelActivitiesTimeline["summary"]["valueClassificationCounts"];

  const items = currentItems.map((item) => {
    const warningCodes = Array.from(
      new Set((item.warningMessages ?? []).map((warning) => warning.trim()).filter(Boolean)),
    );
    const warnings = warningCodes.map((warningCode) => ({
      code: warningCode,
      severity: "Warning" as const,
      source: "local_projection",
      blockedMetrics: [],
    }));
    const valueClassification: ProductReadModelActivitiesTimeline["items"][number]["valueClassification"] =
      warnings.length > 0 ? "preliminary" : "app_calculated";
    const confidence: ProductReadModelActivitiesTimeline["items"][number]["confidence"] =
      warnings.length > 0 ? "medium" : "high";

    valueClassificationCounts[valueClassification] += 1;

    return {
      activityId: item.id,
      activityType: toLocalPrmActivityType(item.type),
      displayType: toLocalPrmActivityType(item.type),
      datetime: item.datetime ?? null,
      date: item.datetime ? item.datetime.slice(0, 10) : null,
      assetKey: toLocalPrmAssetKey(item),
      portfolioId: item.portfolioId ?? "unknown_portfolio",
      warnings,
      blockedMetrics: [],
      confidence,
      valueClassification,
    };
  });

  const warningItemCount = items.filter((item) => item.warnings.length > 0).length;

  return {
    metadata: {
      readModelId: `local-activities-timeline-prm:${generatedAt}`,
      snapshotId: cache.freshness?.scope?.fingerprint ?? null,
      generatedAt,
      sourceType:
        cache.freshness?.source === "snapshot"
          ? "local_snapshot"
          : cache.freshness?.source === "local_derived"
            ? "local_derived"
            : cache.freshness?.source === "provider"
              ? "provider"
              : cache.freshness?.source === "none"
                ? "none"
                : "derived",
      sourceScope: scope.mode === "manual" ? "selected_portfolios" : "global",
      freshnessAt: cache.freshness?.updatedAt ?? cache.freshness?.loadedAt ?? generatedAt,
      freshnessState,
      scopeState,
      selectedPortfolioIds,
      confidence: metadataWarnings.length > 0 ? "medium" : "high",
      warnings: metadataWarnings,
      blockedMetrics: [],
      valueClassification: metadataWarnings.length > 0 ? "preliminary" : "app_calculated",
      providerRequestCount: 0,
    },
    items,
    summary: {
      itemCount: items.length,
      warningItemCount,
      blockerWarningCount: 0,
      blockedMetricItemCount: 0,
      valueClassificationCounts,
    },
  };
}

function getDefaultActivitiesTimelinePrmSelection(): ActivitiesTimelinePrmFeatureFlagSelection {
  return selectActivitiesTimelinePrmFeatureFlagSource({
    currentItems: [],
    projected: null,
    featureFlagEnabled: false,
  });
}

export function selectLocalActivitiesTimelineSource(
  input: SelectLocalActivitiesTimelineSourceInput,
): SelectLocalActivitiesTimelineSourceOutput {
  const selection = selectActivitiesTimelinePrmFeatureFlagSource({
    currentItems: mapActivitiesAuditItemsToSelectorInput(input.currentItems),
    projected: input.projected ?? null,
    featureFlagEnabled: input.featureFlagEnabled,
    diagnosticHarness: input.diagnosticHarness ?? null,
    statusOverride: input.statusOverride,
  });

  if (selection.selectedSource === "productReadModel" && input.projected) {
    return {
      items: mapProductReadModelItemsToActivitiesAuditItems(input.projected, input.currentItems),
      selection,
    };
  }

  return {
    items: input.currentItems,
    selection,
  };
}

export function getEmptyLocalActivityReadModel(): LocalActivityReadModel {
  return {
    items: [],
    portfolios: [],
    scopedPortfolioIds: [],
    loadedPortfolioIds: [],
    missingScopePortfolioIds: [],
    scope: {
      mode: "all",
      selectedPortfolioIds: [],
    },
    generatedAt: null,
    freshness: null,
    source: "none",
    activitiesTimelinePrmSelection: getDefaultActivitiesTimelinePrmSelection(),
  };
}

export const ALL_ACTIVITY_TYPES: AuditActivityType[] = [
  "buy",
  "sell",
  "dividend",
  "transfer_in",
  "transfer_out",
  "unknown",
];

const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function compareNullableString(left: string | null, right: string | null) {
  return (left ?? "").localeCompare(right ?? "", "de-DE", {
    sensitivity: "base",
  });
}

function buildPortfoliosFromItems(
  items: ActivitiesAuditItem[],
  loadedPortfolioIds: string[],
): Portfolio[] {
  const byId = new Map<string, Portfolio>();

  for (const portfolio of loadKnownPortfolios()) {
    byId.set(portfolio.id, portfolio);
  }

  for (const item of items) {
    if (!item.portfolioId || byId.has(item.portfolioId)) continue;

    byId.set(item.portfolioId, {
      id: item.portfolioId,
      name: item.portfolioName || item.portfolioId,
      currency: "",
      createdAt: "",
      distinctBrokers: [],
    });
  }

  for (const id of loadedPortfolioIds) {
    if (byId.has(id)) continue;

    byId.set(id, {
      id,
      name: id,
      currency: "",
      createdAt: "",
      distinctBrokers: [],
    });
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "de-DE", { sensitivity: "base" }),
  );
}

function resolveLocalScope(
  scope: PortfolioScope,
  portfolios: Portfolio[],
  items: ActivitiesAuditItem[],
  loadedPortfolioIds: string[],
) {
  const itemPortfolioIds = unique(
    items.flatMap((item) => (item.portfolioId ? [item.portfolioId] : [])),
  );
  const portfolioIds = unique([
    ...portfolios.map((portfolio) => portfolio.id),
    ...itemPortfolioIds,
  ]);
  const selectable = new Set(portfolioIds);
  const loaded = new Set(unique([...itemPortfolioIds, ...loadedPortfolioIds]));

  if (scope.mode === "all") {
    return {
      scopedPortfolioIds: itemPortfolioIds.length ? itemPortfolioIds : portfolioIds,
      missingScopePortfolioIds: [],
    };
  }

  const requested = unique(scope.selectedPortfolioIds);

  return {
    scopedPortfolioIds: requested.filter((id) => selectable.has(id)),
    missingScopePortfolioIds: requested.filter((id) => !loaded.has(id)),
  };
}

function hydrateActivityMetadata(items: ActivitiesAuditItem[]): ActivitiesAuditItem[] {
  const metadataCache = getMergedAssetMetadataCache();

  return items.map((item) => {
    const normalizedIsin = normalizeIsin(item.isin);
    const metadata = normalizedIsin ? metadataCache[normalizedIsin] : undefined;

    if (!metadata) {
      return item;
    }

    return {
      ...item,
      name: metadata.name ?? metadata.displayName ?? metadata.assetName ?? metadata.title ?? item.name,
      symbol: item.symbol ?? metadata.symbol ?? metadata.ticker ?? metadata.tickerSymbol ?? null,
      wkn: item.wkn ?? metadata.wkn ?? null,
    };
  });
}

export function loadLocalActivityReadModel(): LocalActivityReadModel {
  const cache = loadDashboardCache();
  const scope = loadPortfolioScope();
  const projected = buildLocalActivitiesTimelinePrmProjection(cache, scope);
  const featureFlagEnabled = resolveActivitiesTimelinePrmFeatureFlagEnabled();
  const sourceSelection = selectLocalActivitiesTimelineSource({
    currentItems: cache?.activityItems ?? [],
    projected,
    featureFlagEnabled,
  });
  const items = hydrateActivityMetadata(sourceSelection.items);
  const loadedPortfolioIds = cache?.selectedPortfolioIds ?? [];
  const portfolios = buildPortfoliosFromItems(items, loadedPortfolioIds);
  const scopeResolution = resolveLocalScope(scope, portfolios, items, loadedPortfolioIds);
  const source: LocalActivitySource = !cache
    ? "none"
    : cache.freshness?.source === "snapshot"
      ? "snapshot"
      : "local_derived";

  return {
    items,
    portfolios,
    loadedPortfolioIds,
    scopedPortfolioIds: scopeResolution.scopedPortfolioIds,
    missingScopePortfolioIds: scopeResolution.missingScopePortfolioIds,
    scope,
    generatedAt: cache?.lastUpdatedAt ?? cache?.generatedAt ?? null,
    freshness: cache?.freshness ?? null,
    source,
    activitiesTimelinePrmSelection: sourceSelection.selection,
  };
}

export function getActivityTypeLabel(type: AuditActivityType): string {
  switch (type) {
    case "buy":
      return "Kauf";
    case "sell":
      return "Verkauf";
    case "dividend":
      return "Dividende";
    case "transfer_in":
      return "Einbuchung/Transfer";
    case "transfer_out":
      return "Ausbuchung/Transfer";
    default:
      return "Unbekannt";
  }
}

export function getActivityWarningLabel(count: number): string {
  if (count <= 0) return "Keine Datenhinweise";
  if (count === 1) return "1 Datenhinweis";
  return `${count} Datenhinweise`;
}

export function formatActivityDate(value: string): string {
  return formatDateTime(value, value);
}

export function formatDateOnly(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMATTER.format(date);
}

export function formatOptionalNumber(value: number | null | undefined): string {
  return formatShares(value);
}

export function formatOptionalCurrency(value: number | null | undefined): string {
  return formatCurrency(value);
}

function formatOptionalSafeCurrency(value: number | null | undefined): string | null {
  return value == null ? null : formatCurrency(value);
}

function formatOptionalSafeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getActivityMonthKey(item: ActivitiesAuditItem): string {
  if (item.monthKey) return item.monthKey;

  const date = new Date(item.datetime);
  if (Number.isNaN(date.getTime())) return "unknown";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getActivityMonthLabel(item: ActivitiesAuditItem): string {
  if (item.monthLabel) return item.monthLabel;

  const date = new Date(item.datetime);
  if (Number.isNaN(date.getTime())) return "Ohne Datum";

  return formatMonth(date, "Ohne Datum");
}

export function projectActivity(item: ActivitiesAuditItem): ProjectedActivity {
  const identifierParts = [item.isin, item.symbol, item.wkn]
    .filter(Boolean)
    .map(String);
  const overrideCount = item.overrideCount ?? Object.keys(item.overrideFlags ?? {}).length;
  const assetLabel = item.name || item.isin || item.symbol || "Unbekanntes Asset";

  return {
    id: item.id,
    datetime: item.datetime,
    dateLabel: formatActivityDate(item.datetime),
    monthKey: getActivityMonthKey(item),
    monthLabel: getActivityMonthLabel(item),
    year: item.year || new Date(item.datetime).getFullYear(),
    type: item.type,
    typeLabel: getActivityTypeLabel(item.type),
    assetLabel,
    assetMeta: identifierParts.length ? identifierParts.join(" · ") : "Keine Kennung lokal vorhanden",
    assetHref: createAssetDetailHrefFromParts({
      stableKey: item.isin,
      label: assetLabel,
    }),
    portfolioLabel: item.portfolioName || "Kein Portfolio-Kontext",
    sharesLabel: formatOptionalNumber(item.shares),
    priceLabel: formatOptionalCurrency(item.price),
    amountLabel: formatOptionalCurrency(item.amount),
    amountNetLabel: formatOptionalCurrency(item.amountNet),
    feeLabel: formatOptionalSafeCurrency(item.fee),
    taxLabel: formatOptionalSafeCurrency(item.tax),
    noteLabel: formatOptionalSafeText(item.note),
    warningMessages: item.warningMessages ?? [],
    hasWarnings: (item.warningMessages ?? []).length > 0,
    hasOverrides: Boolean(item.hasOverrides || overrideCount > 0),
    overrideLabel:
      item.hasOverrides || overrideCount > 0
        ? overrideCount > 0
          ? `${overrideCount} Override${overrideCount === 1 ? "" : "s"}`
          : "Override vorhanden"
        : null,
  };
}

export function filterActivities(
  items: ActivitiesAuditItem[],
  filters: ActivityFilters,
): ActivitiesAuditItem[] {
  const query = filters.query.trim().toLowerCase();
  const exactIsin = normalizeExactIsin(filters.exactIsin);
  const portfolioIdSet = new Set(filters.portfolioIds);
  const typeSet = new Set(filters.types);
  const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
  const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;

  return items.filter((item) => {
    const itemTime = new Date(item.datetime).getTime();
    const matchesPortfolio = item.portfolioId
      ? portfolioIdSet.has(item.portfolioId)
      : portfolioIdSet.size === 0;
    const matchesType = typeSet.has(item.type);
    const matchesQuery =
      query.length === 0 ||
      [item.name, item.isin, item.symbol, item.wkn, item.portfolioName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    const matchesExactIsin =
      exactIsin.length === 0 || normalizeExactIsin(item.isin) === exactIsin;
    const matchesFrom = fromTime === null || (!Number.isNaN(itemTime) && itemTime >= fromTime);
    const matchesTo = toTime === null || (!Number.isNaN(itemTime) && itemTime <= toTime);
    const matchesWarnings = !filters.warningsOnly || (item.warningMessages ?? []).length > 0;
    const matchesOverrides = !filters.overridesOnly || Boolean(item.hasOverrides || item.overrideCount);

    return (
      matchesPortfolio &&
      matchesType &&
      matchesQuery &&
      matchesExactIsin &&
      matchesFrom &&
      matchesTo &&
      matchesWarnings &&
      matchesOverrides
    );
  });
}

export function sortActivities(
  items: ActivitiesAuditItem[],
  sort: ActivitySort,
): ActivitiesAuditItem[] {
  const direction = sort.direction === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    let result = 0;

    switch (sort.key) {
      case "asset":
        result = compareNullableString(left.name ?? left.isin, right.name ?? right.isin);
        break;
      case "type":
        result = getActivityTypeLabel(left.type).localeCompare(
          getActivityTypeLabel(right.type),
          "de-DE",
          { sensitivity: "base" },
        );
        break;
      case "amount":
        result = (left.amountNet ?? left.amount ?? 0) - (right.amountNet ?? right.amount ?? 0);
        break;
      default:
        result = new Date(left.datetime).getTime() - new Date(right.datetime).getTime();
    }

    if (result === 0) {
      result = new Date(left.datetime).getTime() - new Date(right.datetime).getTime();
    }

    return result * direction;
  });
}

export function groupProjectedActivities(
  activities: ProjectedActivity[],
  mode: "month" | "year" = "month",
): ActivityGroup[] {
  const groups = new Map<string, ProjectedActivity[]>();

  for (const activity of activities) {
    const key = mode === "year" ? String(activity.year || "unknown") : activity.monthKey;
    groups.set(key, [...(groups.get(key) ?? []), activity]);
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, items]) => ({
      key,
      label: mode === "year" ? (key === "unknown" ? "Ohne Datum" : key) : (items[0]?.monthLabel ?? key),
      items,
    }));
}

export function getSourceLabel(model: Pick<LocalActivityReadModel, "source" | "freshness">): string {
  if (model.source === "none") return "Nicht geladen";
  if (model.freshness?.source === "snapshot") return "Geladener Snapshot";
  return "Lokal geladener Stand";
}

export function getFreshnessLabel(model: Pick<LocalActivityReadModel, "generatedAt" | "freshness">): string {
  if (!model.generatedAt) return "Datenstand unbekannt";

  const base = `Datenstand: ${formatActivityDate(model.generatedAt)}`;

  if (model.freshness?.status === "refresh_failed" || model.freshness?.refreshStatus === "failed") {
    return `${base} · Aktualisierung fehlgeschlagen`;
  }

  if (model.freshness?.stale) {
    return `${base} · möglicherweise veraltet`;
  }

  if (model.freshness?.status === "fresh") {
    return `${base} · aus geladenem Snapshot`;
  }

  return base;
}

export function getFreshnessStatusLabel(
  model: Pick<LocalActivityReadModel, "generatedAt" | "freshness">,
): string {
  if (!model.generatedAt || model.freshness?.status === "missing") {
    return "Nicht geladen / Datenstand unbekannt";
  }

  if (model.freshness?.status === "refresh_failed" || model.freshness?.refreshStatus === "failed") {
    return "Aktualisierung fehlgeschlagen";
  }

  if (model.freshness?.stale || model.freshness?.status === "stale") {
    return "Möglicherweise veraltet";
  }

  if (model.freshness?.status === "fresh") {
    return "Aktuell";
  }

  return "Datenstand bekannt";
}

export function getScopeIndicatorLabel(
  model: Pick<LocalActivityReadModel, "scope" | "scopedPortfolioIds">,
): string {
  if (model.scope.mode === "all") {
    return model.scopedPortfolioIds.length > 0
      ? `Auswahl: alle (${model.scopedPortfolioIds.length})`
      : "Auswahl: alle";
  }

  return model.scopedPortfolioIds.length === 1
    ? "Auswahl: 1 Portfolio"
    : `Auswahl: ${model.scopedPortfolioIds.length} Portfolios`;
}

export function getLoadedScopeIndicatorLabel(
  model: Pick<LocalActivityReadModel, "loadedPortfolioIds" | "generatedAt">,
): string {
  if (!model.generatedAt || model.loadedPortfolioIds.length === 0) {
    return "Geladen: kein Stand";
  }

  return model.loadedPortfolioIds.length === 1
    ? "Geladen: 1 Portfolio"
    : `Geladen: ${model.loadedPortfolioIds.length} Portfolios`;
}
