// src/lib/types.ts

/**
 * ============================================================
 * PORTFOLIOS
 * ============================================================
 *
 * Basistypen für autorisierte Parqet-Portfolios.
 * Diese Typen werden in Dashboard, Activities und API-Responses genutzt.
 */

export type Portfolio = {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
  distinctBrokers: string[];
};

/**
 * ============================================================
 * ASSET METADATA
 * ============================================================
 *
 * Optionale Asset-Metadaten aus lokaler CSV oder später weiteren Quellen.
 *
 * Typischer Erweiterungspunkt:
 * - exchange country
 * - sector / industry
 * - logo url
 * - issuer / fund provider
 */

export type AssetMetadata = {
  name?: string | null;
  assetName?: string | null;
  displayName?: string | null;
  title?: string | null;

  symbol?: string | null;
  ticker?: string | null;
  tickerSymbol?: string | null;

  wkn?: string | null;
  curatedName?: string | null;
  instrumentDisplayName?: string | null;
  instrumentName?: string | null;
  metadataSource?: string | null;
  nameSource?: string | null;
  displayNameSource?: string | null;
  metadataUpdatedAt?: string | null;
  instrumentMetadataStatus?: "ok" | "missing" | "db_unavailable" | "missing_name";
  instrumentMetadataError?: string | null;

  marketPrice?: number | null;
  marketPriceAt?: string | null;
  marketPriceSource?: string | null;

  currency?: string | null;
  assetType?: string | null;
  exchange?: string | null;
};

export type AssetInstrumentPrimaryMapping = {
  provider: string;
  symbol: string;
  exchange: string | null;
  currency: string | null;
  verifiedAt: string | null;
  isPrimary: boolean;
  isActive: boolean;
};

export type AssetInstrumentSnapshot = {
  isin: string;
  displayName: string | null;
  name: string | null;
  wkn: string | null;
  assetType: string | null;
  currency: string | null;
  metadataStatus: "ok" | "missing" | "db_unavailable" | "missing_name";
  metadataError: string | null;
  marketDataStatus: "active" | "excluded" | "legacy" | "derivative" | "unknown" | null;
  marketDataStatusReason: string | null;
  marketDataSuccessorIsin: string | null;
  marketDataSuccessorSymbol: string | null;
  primaryMapping: AssetInstrumentPrimaryMapping | null;
};

/**
 * ============================================================
 * PORTFOLIO POSITIONEN INNERHALB EINES ASSETS
 * ============================================================
 *
 * Dient für die aggregierte Asset-Sicht über mehrere Portfolios.
 * Wird später auch für detailliertere Breakdown-Ansichten relevant bleiben.
 */

export type PortfolioPosition = {
  portfolioId: string;
  portfolioName: string;

  netShares: number;
  remainingCostBasis: number;
  avgBuyPrice: number | null;

  latestTradePrice: number | null;
  marketPrice: number | null;

  positionValue: number | null;
  unrealizedPnL: number | null;

  totalDividendNet: number;
};

/**
 * ============================================================
 * KONSOLIDIERTE ASSET-SICHT
 * ============================================================
 *
 * Zentrale aggregierte Asset-Darstellung für das Dashboard.
 *
 * Typischer Erweiterungspunkt:
 * - internal status flags
 * - override summary
 * - transfer linkage status
 * - warning counters direkt am Asset
 */

export type AssetSummary = {
  isin: string;

  portfolioIds: string[];
  portfolioNames: string[];

  portfolioBreakdown: PortfolioPosition[];

  activityCount: number;
  buyCount: number;
  sellCount: number;
  dividendCount: number;

  totalBoughtShares: number;
  totalSoldShares: number;
  netShares: number;

  totalInvestedGross: number;
  remainingCostBasis: number;
  avgBuyPrice: number | null;

  latestTradePrice: number | null;
  marketPrice: number | null;
  marketPriceAt: string | null;
  marketPriceSource: string | null;

  positionValue: number | null;
  unrealizedPnL: number | null;

  totalDividendNet: number;

  latestActivityAt: string | null;

  name?: string | null;
  assetName?: string | null;
  displayName?: string | null;
  title?: string | null;

  symbol?: string | null;
  ticker?: string | null;
  tickerSymbol?: string | null;

  wkn?: string | null;
  curatedName?: string | null;
  metadataSource?: string | null;
  nameSource?: string | null;
  displayNameSource?: string | null;
  metadataUpdatedAt?: string | null;
  instrumentDisplayName?: string | null;
  instrumentName?: string | null;
  instrumentMetadataStatus?: "ok" | "missing" | "db_unavailable" | "missing_name";
  instrumentMetadataError?: string | null;
  instrument?: AssetInstrumentSnapshot | null;

  metadata?: Partial<AssetMetadata> | null;
  externalMetadata?: Partial<AssetMetadata> | null;
  assetMeta?: Partial<AssetMetadata> | null;
};

/**
 * ============================================================
 * KONSISTENZ / WARNUNGEN
 * ============================================================
 *
 * Diese Typen beschreiben fachliche Inkonsistenzen auf Asset-Ebene.
 * Das ist die Grundlage für Warnungslisten und spätere Prüf-Workflows.
 */

export type AssetConsistencyCheck = {
  isin: string;
  name?: string | null;

  reconstructedNetShares: number;
  remainingCostBasis: number;

  isNegativeShares: boolean;
  isNegativeCostBasis: boolean;
  hasZeroSharesButCostBasis: boolean;
  hasSharesButNoBuyHistory: boolean;
  soldMoreThanBought: boolean;

  warnings: string[];
};

export type ConsistencyReport = {
  checkedAssets: number;
  warningCount: number;
  assetsWithWarnings: AssetConsistencyCheck[];
};

/**
 * ============================================================
 * RECONCILIATION WARNINGS
 * ============================================================
 *
 * Warning-Struktur auf Activity-/Asset-Ebene.
 * Diese Struktur ist bewusst einfach und später DB-ready.
 *
 * Typischer Erweiterungspunkt:
 * - ruleId
 * - status
 * - acknowledgedAt
 * - note
 * - overrideRelation
 */

export type ReconciliationWarning = {
  isin: string;
  message: string;
  severity: "info" | "warning" | "error";
  reviewStatus?: "open" | "overridden" | "accepted";
  source?: "reconciliation" | "override";
  originalValue?: string | number | null;
  overrideValue?: string | number | null;
  lastChangedAt?: string | null;
};

/**
 * ============================================================
 * API RESPONSES: PORTFOLIOS / ASSETS
 * ============================================================
 *
 * Hier hängen die Responses der wichtigsten Dashboard-Routen.
 * Auth-Reconnect-Logik ist hier bereits eingeplant.
 */

export type SnapshotFreshness = {
  present: boolean;
  loadedAt: string | null;
  updatedAt: string | null;
  status: "missing" | "fresh" | "stale" | "refresh_failed";
  source: "provider" | "snapshot" | "local_derived" | "none";
  refreshStatus: "idle" | "refreshing" | "refreshed" | "failed";
  stale: boolean;
  scope: {
    portfolioCount: number;
    fingerprint: string;
  };
  lastRefreshErrorCategory?:
    | "rate_limit"
    | "auth_error"
    | "provider_error"
    | "pipeline_error"
    | "auth_refresh_failed"
    | "missing_access_token"
    | null;
};

export type PortfoliosApiResponse = {
  ok: boolean;
  portfolios?: {
    items: Portfolio[];
  };
  authRequired?: boolean;
  reconnectUrl?: string;
  message?: string;
  details?: string;
};

export type AssetsApiResponse = {
  ok: boolean;

  rawActivityCount?: number;
  filteredActivityCount?: number;

  assetCount?: number;
  activeAssetCount?: number;
  closedAssetCount?: number;

  assets?: AssetSummary[];
  activeAssets?: AssetSummary[];
  closedAssets?: AssetSummary[];

  generatedAt?: string;
  freshness?: SnapshotFreshness;
  activityItems?: ActivitiesAuditItem[];
  instrumentMetadataSummary?: {
    ok: number;
    missing: number;
    missingName: number;
    dbUnavailable: number;
  };
  consistencyReport?: ConsistencyReport | null;
  reconciliationWarnings?: ReconciliationWarning[];

  authRequired?: boolean;
  reconnectUrl?: string;
  message?: string;
  details?: string;
};

/**
 * ============================================================
 * DASHBOARD STATS
 * ============================================================
 *
 * Kennzahlen für Header / Hero / StatsGrid.
 * Falls später weitere KPI-Karten hinzukommen, hier ergänzen.
 */

export type DashboardStats = {
  rawActivityCount: number;
  filteredActivityCount: number;
  assetCount: number;
  activeAssetCount: number;
  closedAssetCount: number;
  totalDividendNet: number;
  totalPositionValue: number;
  totalUnrealizedPnL: number;
};

/**
 * ============================================================
 * AUDIT / ACTIVITIES: BASISTYPEN
 * ============================================================
 *
 * Vereinheitlichte Typen für Audit- und Aktivitätenansicht.
 * Diese Ebene soll künftig auch mit lokal gespeicherten / DB-basierten
 * Activities kompatibel bleiben.
 */

export type AuditActivityType =
  | "buy"
  | "sell"
  | "dividend"
  | "transfer_in"
  | "transfer_out"
  | "unknown";

/**
 * ============================================================
 * OVERRIDE-SYSTEM
 * ============================================================
 *
 * Manuelle Korrekturen einzelner Felder an normalisierten Activities.
 *
 * Wichtig:
 * - Original-Parqet-Daten bleiben unverändert
 * - Overrides sind feldbasiert
 * - die Pipeline arbeitet danach mit korrigierten Werten
 *
 * Typischer Erweiterungspunkt:
 * - userId
 * - updatedAt
 * - deletedAt / active flag
 * - source: "manual" | "rule" | "migration"
 * - note / status / review flags
 */

export type ActivityOverrideField =
  | "type"
  | "datetime"
  | "shares"
  | "price"
  | "amount"
  | "amountNet"
  | "portfolioId"
  | "portfolioName"
  | "isin"
  | "name"
  | "symbol"
  | "wkn";

export type ActivityOverrideValue = string | number | null;

export type ActivityOverride = {
  id: string;
  activityId: string;
  field: ActivityOverrideField;
  value: ActivityOverrideValue;
  reason?: string | null;
  createdAt: string;
  source: "manual";
};

/**
 * Map der geänderten Felder an einer Activity.
 * Beispiel:
 * {
 *   shares: true,
 *   price: true
 * }
 */
export type AppliedOverrideMap = Partial<Record<ActivityOverrideField, true>>;

/**
 * ============================================================
 * AUDIT ITEM: ORIGINAL / OVERRIDE SICHT
 * ============================================================
 *
 * Dieser Typ ist besonders wichtig für das Audit-UI.
 * Hier ergänzen wir künftig sehr wahrscheinlich häufiger:
 * - original vs corrected Werte
 * - notes
 * - warning severity je Feld
 * - rule hits
 * - review status
 */

export type ActivitiesAuditItem = {
  id: string;
  datetime: string;

  year: number;
  monthKey: string;
  monthLabel: string;

  portfolioId: string | null;
  portfolioName: string;

  isin: string;
  name: string | null;
  symbol: string | null;
  wkn: string | null;
  instrumentMetadataStatus?: "ok" | "missing" | "db_unavailable" | "missing_name";
  instrumentMetadataError?: string | null;

  type: AuditActivityType;
  rawType: string;

  shares: number;
  price: number;
  amount: number;
  amountNet: number;
  fee?: number | null;
  tax?: number | null;
  note?: string | null;

  warningMessages: string[];

  /**
   * ------------------------------------------------------------
   * OVERRIDE STATUS
   * ------------------------------------------------------------
   */
  hasOverrides?: boolean;
  overrideFlags?: AppliedOverrideMap;
  overrideCount?: number;

  /**
   * ------------------------------------------------------------
   * ORIGINALWERTE VOR APPLY OVERRIDES
   * ------------------------------------------------------------
   *
   * Diese Werte kommen bewusst aus der normalisierten Activity
   * VOR dem Override-Layer.
   *
   * Typischer Erweiterungspunkt:
   * - datetime
   * - portfolioId
   * - portfolioName
   * - isin
   * - symbol
   * - wkn
   */
  originalValues?: {
    shares?: number | null;
    price?: number | null;
    amount?: number | null;
    amountNet?: number | null;
    type?: string | null;
  };

  /**
   * ------------------------------------------------------------
   * OVERRIDEWERTE PRO FELD
   * ------------------------------------------------------------
   *
   * Für das UI ist ein Feld->Wert Mapping oft praktischer
   * als das rohe appliedOverrides-Array.
   */
  overrideValues?: Record<string, string | number | null> | null;
};

export type ActivitiesAuditSummary = {
  total: number;
  buyCount: number;
  sellCount: number;
  dividendCount: number;
  transferInCount: number;
  transferOutCount: number;
  unknownCount: number;
};

export type ActivitiesAuditPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type ActivitiesAuditApiResponse = {
  ok: boolean;
  generatedAt: string;
  portfolios: Portfolio[];
  items: ActivitiesAuditItem[];
  reconciliationWarnings: ReconciliationWarning[];
  summary: ActivitiesAuditSummary;
  pagination?: ActivitiesAuditPagination;
  freshness?: SnapshotFreshness;
  apiBudget?: import("./parqet-api-diagnostics").ParqetApiBudgetInfo;
  authRequired?: boolean;
  reconnectUrl?: string;
  message?: string;
  details?: string;
};

/**
 * ============================================================
 * OVERRIDE API RESPONSES
 * ============================================================
 *
 * Responses für Lesen / Schreiben von Activity Overrides.
 * Hier hängen künftig evtl. auch delete/update Varianten dran.
 */

export type ActivityOverridesApiResponse = {
  ok: boolean;
  items: ActivityOverride[];
  message?: string;
  details?: string;
};

export type SaveActivityOverrideApiResponse = {
  ok: boolean;
  item?: ActivityOverride;
  deleted?: boolean;
  message?: string;
  details?: string;
};
