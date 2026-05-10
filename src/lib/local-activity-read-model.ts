import { loadDashboardCache } from "./dashboard-cache";
import { formatCurrency, formatDateTime, formatMonth, formatShares } from "./format";
import {
  loadKnownPortfolios,
  loadPortfolioScope,
  type PortfolioScope,
} from "./app-settings";
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
};

export type ActivitySortKey = "date" | "asset" | "type" | "amount";
export type ActivitySortDirection = "asc" | "desc";

export type ActivityFilters = {
  portfolioIds: string[];
  query: string;
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
  portfolioLabel: string;
  sharesLabel: string;
  priceLabel: string;
  amountLabel: string;
  amountNetLabel: string;
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

export function loadLocalActivityReadModel(): LocalActivityReadModel {
  const cache = loadDashboardCache();
  const items = cache?.activityItems ?? [];
  const loadedPortfolioIds = cache?.selectedPortfolioIds ?? [];
  const portfolios = buildPortfoliosFromItems(items, loadedPortfolioIds);
  const scope = loadPortfolioScope();
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
  if (count <= 0) return "Keine Warnungen";
  if (count === 1) return "1 Warnung";
  return `${count} Warnungen`;
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

  return {
    id: item.id,
    datetime: item.datetime,
    dateLabel: formatActivityDate(item.datetime),
    monthKey: getActivityMonthKey(item),
    monthLabel: getActivityMonthLabel(item),
    year: item.year || new Date(item.datetime).getFullYear(),
    type: item.type,
    typeLabel: getActivityTypeLabel(item.type),
    assetLabel: item.name || item.isin || item.symbol || "Unbekanntes Asset",
    assetMeta: identifierParts.length ? identifierParts.join(" · ") : "Keine Kennung lokal vorhanden",
    portfolioLabel: item.portfolioName || "Kein Portfolio-Kontext",
    sharesLabel: formatOptionalNumber(item.shares),
    priceLabel: formatOptionalCurrency(item.price),
    amountLabel: formatOptionalCurrency(item.amount),
    amountNetLabel: formatOptionalCurrency(item.amountNet),
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
    const matchesFrom = fromTime === null || (!Number.isNaN(itemTime) && itemTime >= fromTime);
    const matchesTo = toTime === null || (!Number.isNaN(itemTime) && itemTime <= toTime);
    const matchesWarnings = !filters.warningsOnly || (item.warningMessages ?? []).length > 0;
    const matchesOverrides = !filters.overridesOnly || Boolean(item.hasOverrides || item.overrideCount);

    return (
      matchesPortfolio &&
      matchesType &&
      matchesQuery &&
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
  if (model.freshness?.source === "snapshot") return "Snapshot / lokale geladene Daten";
  return "Lokale geladene Daten";
}

export function getFreshnessLabel(model: Pick<LocalActivityReadModel, "generatedAt" | "freshness">): string {
  if (!model.generatedAt) return "Datenstand unbekannt";

  const base = `Datenstand: ${formatActivityDate(model.generatedAt)}`;

  if (model.freshness?.stale) {
    return `${base} · möglicherweise veraltet`;
  }

  if (model.freshness?.status === "fresh") {
    return `${base} · frisch`;
  }

  return base;
}
