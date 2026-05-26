// ============================================================
// src/app/api/parqet/assets/route.ts
// ------------------------------------------------------------
// Diese Route orchestriert:
//
// - Token pruefen
// - Portfolios / Activities laden
// - filtern
// - normalisieren
// - Overrides anwenden
// - Reconciliation-Warnungen bauen
// - bereinigte Assets erzeugen
// - lokale CSV-Metadaten anreichern
// - aktive / geschlossene Assets trennen
// - Konsistenzreport berechnen
// ============================================================

import { NextResponse } from "next/server";
import type { ActivitiesAuditItem, GlobalAssetViewModel } from "../../../../lib/types";
import {
  clearParqetTokenCookies,
  getCookieValue,
  refreshParqetAccessToken,
  setParqetTokenCookies,
  type TokenRefreshResult,
} from "../../../../lib/parqet";
import {
  buildActivityScanBudgetInfo,
  classifyParqetApiError,
  getErrorMessage,
  messageForDiagnostic,
  redactProviderErrorMessage,
  type ParqetApiDiagnostic,
} from "../../../../lib/parqet-api-diagnostics";
import { buildActivityContext } from "../../../../lib/parqet-assets/build-activity-context";
import { toNumber } from "../../../../lib/parqet-assets/activity-utils";
import {
  getActivitySnapshotFreshness,
  markActivitySnapshotRefreshFailed,
} from "../../../../lib/parqet-assets/activity-snapshot";
import { buildConsistencyReport } from "../../../../lib/parqet-assets/consistency";
import { buildCorrectedAssets } from "../../../../lib/parqet-assets/build-corrected-assets";
import { buildGlobalAssetProductReadModelFromActivityContext } from "../../../../lib/parqet/global-assets/coexistence";
import {
  chooseCuratedDisplayName,
  getMarketInstrumentMetadataByIsins,
  getPrimarySymbolMappingsByIsins,
  isMeaningfulInstrumentName,
  MarketDataRepositoryError,
} from "../../../../lib/market-data/db/repository";
import { recordUnknownMarketDataRequestsFromAssets } from "../../../../lib/market-data/runtime-requests";
import type {
  DbMarketInstrumentMetadata,
  DbMarketSymbolMapping,
} from "../../../../lib/market-data/db/types-core";

const CLOSED_POSITION_EPSILON = 1e-8;
const INSTRUMENT_METADATA_MISSING_TITLE = "Stammdaten fehlen";
const INSTRUMENT_DB_UNAVAILABLE_MESSAGE = "Instrumenten-Stammdaten konnten nicht aus der Datenbank geladen werden";
const ASSETS_API_BUDGET = buildActivityScanBudgetInfo({
  activityFetchScope: "selected_portfolios",
  responseFlagsReduceProviderCalls: false,
});

function buildReconnectResponse(message: string) {
  const response = NextResponse.json(
    {
      ok: false,
      activeAssets: [],
      closedAssets: [],
      rawActivityCount: 0,
      filteredActivityCount: 0,
      assetCount: 0,
      activeAssetCount: 0,
      closedAssetCount: 0,
      consistencyReport: null,
      reconciliationWarnings: [],
      generatedAt: new Date().toISOString(),
      authRequired: true,
      reconnectUrl: "/api/auth/start",
      message,
      apiBudget: ASSETS_API_BUDGET,
    },
    { status: 401 },
  );

  clearParqetTokenCookies(response, { clearRefreshToken: true });

  return response;
}

function buildTemporaryAuthFailureResponse(input: {
  message?: string;
  refreshed: boolean;
  portfolioIds: string[];
}) {
  const diagnostic: ParqetApiDiagnostic = { category: "provider_error" };
  const freshness = markActivitySnapshotRefreshFailed(
    input.portfolioIds,
    "provider_error",
  );

  return NextResponse.json(
    {
      ok: false,
      refreshed: input.refreshed,
      authRequired: false,
      message:
        input.message ??
        "Parqet ist vorübergehend nicht erreichbar. Bitte versuche die Aktualisierung später erneut.",
      diagnostic,
      freshness,
      apiBudget: ASSETS_API_BUDGET,
    },
    { status: 503 },
  );
}

function isInvalidRefresh(result: TokenRefreshResult): boolean {
  return !result.ok && result.reason === "invalid_refresh";
}

function isTemporaryRefreshFailure(result: TokenRefreshResult): boolean {
  return (
    !result.ok &&
    (result.reason === "provider_error" ||
      result.reason === "network_error" ||
      result.reason === "unknown" ||
      result.reason === "missing_client_id")
  );
}

function getMonthKey(value: string): string {
  return value.slice(0, 7);
}

function getMonthLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 7);
  }

  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildActivityItems(
  activityContext: Awaited<ReturnType<typeof buildActivityContext>>,
  marketMetadataByIsin: Record<string, DbMarketInstrumentMetadata> = {},
  marketMetadataDbAvailable = true,
): ActivitiesAuditItem[] {
  return activityContext.correctedActivities
    .map((activity) => {
      const datetime = activity.datetime ?? "";
      const isin = normalizeLookupIsin(activity.isin ?? "");
      const resolution = resolveInstrumentMetadataForIsin({
        isin,
        marketMetadataByIsin,
        marketMetadataDbAvailable,
      });
      const instrumentMetadataStatus: ActivitiesAuditItem["instrumentMetadataStatus"] =
        resolution.status;
      const instrumentMetadataError = resolution.error;

      return {
        id: activity.id,
        datetime,
        year: new Date(datetime).getFullYear(),
        monthKey: getMonthKey(datetime),
        monthLabel: getMonthLabel(datetime),
        portfolioId: activity.portfolioId ?? null,
        portfolioName: activity.portfolioId
          ? (activityContext.portfolioNameById.get(activity.portfolioId) ??
            activity.portfolioId)
          : "Unknown Portfolio",
        isin,
        name:
          instrumentMetadataStatus === "ok"
            ? resolution.instrumentDisplayName
            : INSTRUMENT_METADATA_MISSING_TITLE,
        symbol: activity.symbol ?? null,
        wkn: activity.wkn ?? resolution.wkn ?? null,
        instrumentMetadataStatus,
        instrumentMetadataError,
        type: activity.type ?? "unknown",
        rawType: activity.rawType ?? activity.type ?? "unknown",
        shares: toNumber(activity.shares),
        price: toNumber(activity.price),
        amount: toNumber(activity.amount),
        amountNet: toNumber(activity.amountNet),
        warningMessages: activityContext.reconciliationWarnings
          .filter((warning) => warning.isin === isin)
          .map((warning) => warning.message),
        hasOverrides: activity.hasOverrides,
        overrideFlags: activity.overrideFlags,
        overrideCount: activity.appliedOverrides?.length ?? 0,
      };
    })
    .sort((a, b) => b.datetime.localeCompare(a.datetime));
}

function normalizeWeakText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

function normalizeLookupIsin(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

function getMarketMetadataForIsin(
  isin: string,
  marketMetadataByIsin: Record<string, DbMarketInstrumentMetadata>,
): DbMarketInstrumentMetadata | null {
  const normalized = normalizeLookupIsin(isin);
  if (!normalized) return null;
  return marketMetadataByIsin[normalized] ?? null;
}

function buildInstrumentSubtitle(input: {
  isin: string;
  wkn?: string | null;
  error?: string | null;
}): string {
  const parts = [`ISIN ${input.isin}`];
  if (input.wkn && input.wkn.trim()) {
    parts.push(`WKN ${input.wkn.trim()}`);
  }
  if (input.error && input.error.trim()) {
    parts.push(input.error.trim());
  }
  return parts.join(" • ");
}

type InstrumentMetadataResolution = {
  status: "ok" | "missing" | "db_unavailable" | "missing_name";
  error: string | null;
  instrumentDisplayName: string | null;
  instrumentName: string | null;
  wkn: string | null;
  assetType: string | null;
  currency: string | null;
  metadataSource: string | null;
  metadataUpdatedAt: string | null;
  nameSource: string | null;
  displayNameSource: string | null;
  marketDataStatus: NonNullable<GlobalAssetViewModel["instrument"]>["marketDataStatus"];
  marketDataStatusReason: string | null;
  marketDataSuccessorIsin: string | null;
  marketDataSuccessorSymbol: string | null;
};

function mapPrimaryMappingToInstrument(
  mapping: DbMarketSymbolMapping | null | undefined,
): NonNullable<GlobalAssetViewModel["instrument"]>["primaryMapping"] {
  if (!mapping) {
    return null;
  }

  return {
    provider: mapping.provider,
    symbol: mapping.symbol,
    exchange: mapping.exchange ?? null,
    currency: mapping.currency ?? null,
    verifiedAt: mapping.verifiedAt ?? null,
    isPrimary: mapping.isPrimary,
    isActive: mapping.isActive,
  };
}

function buildInstrumentSnapshot(input: {
  isin: string;
  resolution: InstrumentMetadataResolution;
  primaryMapping?: DbMarketSymbolMapping | null;
}): NonNullable<GlobalAssetViewModel["instrument"]> {
  return {
    isin: input.isin,
    displayName: input.resolution.instrumentDisplayName,
    name: input.resolution.instrumentName,
    wkn: input.resolution.wkn,
    assetType: input.resolution.assetType,
    currency: input.resolution.currency,
    metadataStatus: input.resolution.status,
    metadataError: input.resolution.error,
    marketDataStatus: input.resolution.marketDataStatus,
    marketDataStatusReason: input.resolution.marketDataStatusReason,
    marketDataSuccessorIsin: input.resolution.marketDataSuccessorIsin,
    marketDataSuccessorSymbol: input.resolution.marketDataSuccessorSymbol,
    primaryMapping: mapPrimaryMappingToInstrument(input.primaryMapping),
  };
}

function resolveInstrumentMetadataForIsin(input: {
  isin: string;
  marketMetadataByIsin: Record<string, DbMarketInstrumentMetadata>;
  marketMetadataDbAvailable: boolean;
}): InstrumentMetadataResolution {
  const normalizedIsin = normalizeLookupIsin(input.isin);
  if (!normalizedIsin) {
    return {
      status: "ok",
      error: null,
      instrumentDisplayName: null,
      instrumentName: null,
      wkn: null,
      assetType: null,
      currency: null,
      metadataSource: null,
      metadataUpdatedAt: null,
      nameSource: null,
      displayNameSource: null,
      marketDataStatus: null,
      marketDataStatusReason: null,
      marketDataSuccessorIsin: null,
      marketDataSuccessorSymbol: null,
    };
  }

  if (!input.marketMetadataDbAvailable) {
    return {
      status: "db_unavailable",
      error: INSTRUMENT_DB_UNAVAILABLE_MESSAGE,
      instrumentDisplayName: null,
      instrumentName: null,
      wkn: null,
      assetType: null,
      currency: null,
      metadataSource: null,
      metadataUpdatedAt: null,
      nameSource: null,
      displayNameSource: null,
      marketDataStatus: null,
      marketDataStatusReason: null,
      marketDataSuccessorIsin: null,
      marketDataSuccessorSymbol: null,
    };
  }

  const marketMetadata = getMarketMetadataForIsin(
    normalizedIsin,
    input.marketMetadataByIsin,
  );
  if (!marketMetadata) {
    return {
      status: "missing",
      error: `Keine Stammdaten in market_instruments für ISIN ${normalizedIsin}`,
      instrumentDisplayName: null,
      instrumentName: null,
      wkn: null,
      assetType: null,
      currency: null,
      metadataSource: null,
      metadataUpdatedAt: null,
      nameSource: null,
      displayNameSource: null,
      marketDataStatus: null,
      marketDataStatusReason: null,
      marketDataSuccessorIsin: null,
      marketDataSuccessorSymbol: null,
    };
  }

  const curatedDisplayName = normalizeWeakText(marketMetadata.displayName);
  const curatedName = chooseCuratedDisplayName(marketMetadata, null);
  const finalDisplayName = isMeaningfulInstrumentName(curatedName, normalizedIsin)
    ? (curatedDisplayName ?? curatedName)
    : null;
  const finalName = isMeaningfulInstrumentName(curatedName, normalizedIsin)
    ? curatedName
    : null;
  const status: GlobalAssetViewModel["instrumentMetadataStatus"] =
    finalDisplayName && finalName ? "ok" : "missing_name";

  return {
    status,
    error:
      status === "ok"
        ? null
        : `Instrumentenname fehlt in market_instruments für ISIN ${normalizedIsin}`,
    instrumentDisplayName: finalDisplayName,
    instrumentName: finalName,
    wkn: normalizeWeakText(marketMetadata.wkn),
    assetType: normalizeWeakText(marketMetadata.assetType),
    currency: normalizeWeakText(marketMetadata.currency)?.toUpperCase() ?? null,
    metadataSource: normalizeWeakText(marketMetadata.metadataSource),
    metadataUpdatedAt: normalizeWeakText(marketMetadata.metadataUpdatedAt),
    nameSource: normalizeWeakText(marketMetadata.nameSource),
    displayNameSource: normalizeWeakText(marketMetadata.displayNameSource),
    marketDataStatus: marketMetadata.marketDataStatus ?? null,
    marketDataStatusReason: normalizeWeakText(marketMetadata.marketDataStatusReason),
    marketDataSuccessorIsin: normalizeWeakText(marketMetadata.marketDataSuccessorIsin),
    marketDataSuccessorSymbol: normalizeWeakText(marketMetadata.marketDataSuccessorSymbol),
  };
}

function overlayGlobalAssetProductDisplayFromMarketMetadata(input: {
  globalAssetProductReadModel: unknown;
  marketMetadataByIsin: Record<string, DbMarketInstrumentMetadata>;
  primaryMappingsByIsin: Record<string, DbMarketSymbolMapping>;
  marketMetadataDbAvailable: boolean;
}): unknown {
  const model = input.globalAssetProductReadModel;
  if (!model || typeof model !== "object") {
    return model;
  }

  const assets = (model as { assets?: unknown[] }).assets;
  if (!Array.isArray(assets)) {
    return model;
  }

  const nextAssets = assets.map((asset) => {
    if (!asset || typeof asset !== "object") {
      return asset;
    }

    const identity = (asset as { identity?: { compatibilityIsin?: string | null } }).identity;
    const compatibilityIsin = normalizeLookupIsin(identity?.compatibilityIsin ?? "");
    if (!compatibilityIsin) {
      return asset;
    }
    const resolution = resolveInstrumentMetadataForIsin({
      isin: compatibilityIsin,
      marketMetadataByIsin: input.marketMetadataByIsin,
      marketMetadataDbAvailable: input.marketMetadataDbAvailable,
    });
    const primaryMapping = input.primaryMappingsByIsin[compatibilityIsin] ?? null;
    const instrument = buildInstrumentSnapshot({
      isin: compatibilityIsin,
      resolution,
      primaryMapping,
    });

    return {
      ...asset,
      instrument,
      display: {
        ...((asset as { display?: Record<string, unknown> }).display ?? {}),
        displayName:
          resolution.status === "ok"
            ? resolution.instrumentDisplayName
            : INSTRUMENT_METADATA_MISSING_TITLE,
        wkn: resolution.wkn ?? null,
        subtitle: buildInstrumentSubtitle({
          isin: compatibilityIsin,
          wkn: resolution.wkn,
          error: resolution.error,
        }),
      },
    };
  });

  return {
    ...(model as Record<string, unknown>),
    assets: nextAssets,
  };
}

function isWeakAssetType(value: string | null | undefined): boolean {
  const normalized = normalizeWeakText(value)?.toLowerCase() ?? "";
  return !normalized || normalized === "unknown" || normalized === "other" || normalized === "n/a";
}

function isWeakCurrency(value: string | null | undefined): boolean {
  const normalized = normalizeWeakText(value)?.toUpperCase() ?? "";
  return !normalized || normalized === "UNKNOWN" || normalized === "N/A";
}

function applyMarketInstrumentMetadataOverlay(
  asset: GlobalAssetViewModel,
  marketMetadataByIsin: Record<string, DbMarketInstrumentMetadata>,
  primaryMappingsByIsin: Record<string, DbMarketSymbolMapping>,
  marketMetadataDbAvailable: boolean,
): GlobalAssetViewModel {
  const normalizedIsin = normalizeLookupIsin(asset.isin);
  if (!normalizedIsin) {
    return {
      ...asset,
      instrumentMetadataStatus: "ok",
      instrumentMetadataError: null,
      instrument: null,
    };
  }

  const resolution = resolveInstrumentMetadataForIsin({
    isin: normalizedIsin,
    marketMetadataByIsin,
    marketMetadataDbAvailable,
  });

  const currentAssetType =
    normalizeWeakText(asset.externalMetadata?.assetType) ??
    normalizeWeakText(asset.metadata?.assetType) ??
    normalizeWeakText(asset.assetMeta?.assetType);
  const currentCurrency =
    normalizeWeakText(asset.externalMetadata?.currency) ??
    normalizeWeakText(asset.metadata?.currency) ??
    normalizeWeakText(asset.assetMeta?.currency);

  const shouldApplyAssetType =
    Boolean(resolution.assetType) && isWeakAssetType(currentAssetType);
  const shouldApplyCurrency =
    Boolean(resolution.currency) && isWeakCurrency(currentCurrency);
  const finalDisplayName =
    resolution.status === "ok" ? resolution.instrumentDisplayName : null;
  const finalName =
    resolution.status === "ok" ? resolution.instrumentName : null;
  const status: GlobalAssetViewModel["instrumentMetadataStatus"] = resolution.status;
  const statusError = resolution.error;
  const primaryMapping = primaryMappingsByIsin[normalizedIsin] ?? null;
  const instrumentSnapshot = buildInstrumentSnapshot({
    isin: normalizedIsin,
    resolution,
    primaryMapping,
  });

  const existingWkn = normalizeWeakText(asset.wkn);

  return {
    ...asset,
    name: finalName ?? INSTRUMENT_METADATA_MISSING_TITLE,
    instrumentMetadataStatus: status,
    instrumentMetadataError: statusError,
    instrument: instrumentSnapshot,
    wkn: instrumentSnapshot.wkn ?? existingWkn ?? asset.wkn,
    symbol: instrumentSnapshot.primaryMapping?.symbol ?? asset.symbol ?? null,
    metadataSource: resolution.metadataSource ?? asset.metadataSource ?? null,
    nameSource: resolution.nameSource ?? asset.nameSource ?? null,
    displayNameSource:
      resolution.displayNameSource ?? asset.displayNameSource ?? null,
    metadataUpdatedAt:
      resolution.metadataUpdatedAt ?? asset.metadataUpdatedAt ?? null,
    metadata: {
      ...(asset.metadata ?? {}),
      name: finalName ?? null,
      wkn: resolution.wkn ?? existingWkn ?? asset.wkn ?? null,
      symbol: instrumentSnapshot.primaryMapping?.symbol ?? null,
      metadataSource: resolution.metadataSource ?? asset.metadata?.metadataSource ?? null,
      nameSource: resolution.nameSource ?? asset.metadata?.nameSource ?? null,
      displayNameSource:
        resolution.displayNameSource ?? asset.metadata?.displayNameSource ?? null,
      metadataUpdatedAt:
        resolution.metadataUpdatedAt ?? asset.metadata?.metadataUpdatedAt ?? null,
      instrumentMetadataStatus: status,
      instrumentMetadataError: statusError,
      assetType:
        shouldApplyAssetType
          ? resolution.assetType
          : asset.metadata?.assetType ?? null,
      currency:
        shouldApplyCurrency
          ? resolution.currency
          : asset.metadata?.currency ?? null,
    },
    externalMetadata: {
      ...(asset.externalMetadata ?? {}),
      name: finalName ?? null,
      wkn: resolution.wkn ?? existingWkn ?? asset.externalMetadata?.wkn ?? null,
      symbol: instrumentSnapshot.primaryMapping?.symbol ?? null,
      assetType:
        shouldApplyAssetType
          ? resolution.assetType
          : asset.externalMetadata?.assetType ?? null,
      currency:
        shouldApplyCurrency
          ? resolution.currency
          : asset.externalMetadata?.currency ?? null,
      metadataSource:
        resolution.metadataSource ?? asset.externalMetadata?.metadataSource ?? null,
      nameSource: resolution.nameSource ?? asset.externalMetadata?.nameSource ?? null,
      displayNameSource:
        resolution.displayNameSource ??
        asset.externalMetadata?.displayNameSource ??
        null,
      metadataUpdatedAt:
        resolution.metadataUpdatedAt ??
        asset.externalMetadata?.metadataUpdatedAt ??
        null,
      instrumentMetadataStatus: status,
      instrumentMetadataError: statusError,
    },
  };
}

function getStatusForDiagnostic(diagnostic: ParqetApiDiagnostic): number {
  switch (diagnostic.category) {
    case "rate_limit":
      return 429;
    case "auth_error":
    case "auth_refresh_failed":
    case "missing_access_token":
      return 401;
    case "provider_error":
    case "pipeline_error":
      return 500;
  }
}

function buildFailureResponse(input: {
  diagnostic: ParqetApiDiagnostic;
  error: unknown;
  refreshed: boolean;
  portfolioIds?: string[];
}) {
  const freshness = input.portfolioIds
    ? markActivitySnapshotRefreshFailed(
        input.portfolioIds,
        input.diagnostic.category,
      )
    : undefined;
  return NextResponse.json(
    {
      ok: false,
      message: messageForDiagnostic(input.diagnostic),
      refreshed: input.refreshed,
      diagnostic: input.diagnostic,
      error: redactProviderErrorMessage(getErrorMessage(input.error)),
      freshness,
      apiBudget: ASSETS_API_BUDGET,
    },
    { status: getStatusForDiagnostic(input.diagnostic) },
  );
}

// ============================================================
// GET /api/parqet/assets
// ============================================================

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const portfolioIds = Array.from(
      new Set(
        url.searchParams
          .getAll("portfolioId")
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );
    const explicitRefresh = url.searchParams.get("refresh") === "1";

    if (portfolioIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Keine portfolioId-Parameter vorhanden.",
          apiBudget: ASSETS_API_BUDGET,
        },
        { status: 400 },
      );
    }

    const cookieHeader = req.headers.get("cookie") || "";

    let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
    const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

    if (!accessToken && !refreshToken) {
      return buildReconnectResponse(
        "Parqet-Verbindung nicht vorhanden oder abgelaufen.",
      );
    }

    // ========================================================
    // Zentrale Build-Pipeline
    // ========================================================

    async function buildAssetView(currentAccessToken: string) {
      if (!explicitRefresh) {
        const freshness = getActivitySnapshotFreshness(portfolioIds);

        if (!freshness.present) {
          return {
            rawActivityCount: 0,
            filteredActivityCount: 0,
            assetCount: 0,
            activeAssetCount: 0,
            closedAssetCount: 0,
            activeAssets: [],
            closedAssets: [],
            consistencyReport: null,
            reconciliationWarnings: [],
            generatedAt: new Date().toISOString(),
            freshness,
            activityItems: [],
            message:
              "No Activity snapshot exists for this portfolio scope. Use an explicit Dashboard refresh to load provider data.",
            globalAssetProductReadModel: null,
            apiBudget: {
              ...ASSETS_API_BUDGET,
              providerCallsMayOccur: false,
              activityFetchMayOccur: false,
              notes: [
                "No provider call was made because this request did not include refresh=1.",
                "Use the Dashboard explicit refresh action to update the snapshot.",
              ],
            },
          };
        }
      }

      const activityContext = await buildActivityContext(
        currentAccessToken,
        portfolioIds,
        { refresh: explicitRefresh },
      );

      const correctedAssets = buildCorrectedAssets(
        activityContext.correctedActivities,
        activityContext.portfolioNameById,
      );

      // ====================================================
      // Lokale Metadaten laden
      // ----------------------------------------------------
      // Diese Quelle kommt jetzt aus:
      // - generierter CSV-Mapping-Datei
      // - optionalem lokalem Seed
      //
      // WICHTIG:
      // Beim Namen gilt bewusst:
      // CSV-Metadata -> Activity-Name -> Fallback
      // ====================================================

      let marketMetadataByIsin: Record<string, DbMarketInstrumentMetadata> = {};
      let primaryMappingsByIsin: Record<string, DbMarketSymbolMapping> = {};
      let marketMetadataDbAvailable = true;
      try {
        marketMetadataByIsin = await getMarketInstrumentMetadataByIsins(
          correctedAssets.map((asset: GlobalAssetViewModel) => asset.isin),
        );
        primaryMappingsByIsin = await getPrimarySymbolMappingsByIsins(
          correctedAssets.map((asset: GlobalAssetViewModel) => asset.isin),
        );
      } catch (error) {
        marketMetadataDbAvailable = false;
        if (error instanceof MarketDataRepositoryError) {
          console.warn(
            "[parqet-assets] market_instruments metadata overlay unavailable:",
            error.code,
          );
        } else {
          console.warn(
            "[parqet-assets] market_instruments metadata overlay failed",
          );
        }
      }

      const enrichedAssets: GlobalAssetViewModel[] = correctedAssets.map(
        (asset: GlobalAssetViewModel) => {
          return {
            ...asset,
            externalMetadata: { ...(asset.externalMetadata ?? {}) },
          };
        },
      );

      const assetsWithMarketMetadata: GlobalAssetViewModel[] = enrichedAssets.map((asset) =>
        applyMarketInstrumentMetadataOverlay(
          asset,
          marketMetadataByIsin,
          primaryMappingsByIsin,
          marketMetadataDbAvailable,
        ),
      );
      if (marketMetadataDbAvailable) {
        try {
          await recordUnknownMarketDataRequestsFromAssets({
            assets: assetsWithMarketMetadata,
            knownIsins: new Set(Object.keys(marketMetadataByIsin)),
          });
        } catch {
          // Queue recording is best-effort; user runtime responses must remain stable.
        }
      } else {
        // Skip runtime unknown-request recording when metadata lookup is unavailable.
      }

      const activeAssets = assetsWithMarketMetadata.filter(
        (asset: GlobalAssetViewModel) => asset.netShares > CLOSED_POSITION_EPSILON,
      );

      const closedAssets = assetsWithMarketMetadata.filter(
        (asset: GlobalAssetViewModel) => asset.netShares <= CLOSED_POSITION_EPSILON,
      );

      const consistencyReport = buildConsistencyReport(assetsWithMarketMetadata);
      const instrumentMetadataSummary = assetsWithMarketMetadata.reduce(
        (summary, asset) => {
          switch (asset.instrumentMetadataStatus) {
            case "ok":
              summary.ok += 1;
              break;
            case "missing":
              summary.missing += 1;
              break;
            case "missing_name":
              summary.missingName += 1;
              break;
            case "db_unavailable":
              summary.dbUnavailable += 1;
              break;
            default:
              summary.missing += 1;
              break;
          }
          return summary;
        },
        { ok: 0, missing: 0, missingName: 0, dbUnavailable: 0 },
      );
      const generatedAt = new Date().toISOString();
      const globalAssetProductReadModelRaw =
        buildGlobalAssetProductReadModelFromActivityContext({
          activityContext,
          requestedPortfolioIds: portfolioIds,
          generatedAt,
        });
      const globalAssetProductReadModel =
        overlayGlobalAssetProductDisplayFromMarketMetadata({
          globalAssetProductReadModel: globalAssetProductReadModelRaw,
          marketMetadataByIsin,
          primaryMappingsByIsin,
          marketMetadataDbAvailable,
        });

      return {
        rawActivityCount: activityContext.rawActivityCount,
        filteredActivityCount: activityContext.filteredActivities.length,
        assetCount: assetsWithMarketMetadata.length,
        activeAssetCount: activeAssets.length,
        closedAssetCount: closedAssets.length,
        activeAssets,
        closedAssets,
        consistencyReport,
        reconciliationWarnings: activityContext.reconciliationWarnings,
        instrumentMetadataSummary,
        generatedAt,
        freshness: activityContext.freshness,
        activityItems: buildActivityItems(activityContext, marketMetadataByIsin, marketMetadataDbAvailable),
        globalAssetProductReadModel,
        apiBudget: ASSETS_API_BUDGET,
      };
    }

    // ========================================================
    // Erster Versuch mit aktuellem Access Token
    // ========================================================

    try {
      let refreshedFromMissingAccess: TokenRefreshResult | null = null;

      if (!accessToken && refreshToken) {
        const refreshed = await refreshParqetAccessToken(refreshToken);

        if (isInvalidRefresh(refreshed)) {
          return buildReconnectResponse(
            "Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden.",
          );
        }

        if (isTemporaryRefreshFailure(refreshed)) {
          return buildTemporaryAuthFailureResponse({
            refreshed: false,
            portfolioIds,
          });
        }

        if (!refreshed.ok) {
          return buildReconnectResponse("Parqet-Verbindung muss erneuert werden.");
        }

        accessToken = refreshed.accessToken;
        refreshedFromMissingAccess = refreshed;
      }

      if (!accessToken) {
        return buildReconnectResponse(
          "Parqet-Verbindung nicht vorhanden oder abgelaufen.",
        );
      }

      const result = await buildAssetView(accessToken);

      const response = NextResponse.json({
        ok: true,
        refreshed: refreshedFromMissingAccess?.ok ?? false,
        requestedPortfolioIds: portfolioIds,
        ...result,
      });

      if (refreshedFromMissingAccess?.ok) {
        setParqetTokenCookies(response, {
          accessToken,
          refreshToken: refreshedFromMissingAccess.newRefreshToken,
          accessTokenExpiresInSeconds:
            refreshedFromMissingAccess.accessTokenExpiresInSeconds ?? null,
          refreshTokenExpiresInSeconds:
            refreshedFromMissingAccess.refreshTokenExpiresInSeconds ?? null,
        });
      }

      return response;
    } catch (error) {
      const diagnostic = classifyParqetApiError(error);

      if (diagnostic.category !== "auth_error") {
        return buildFailureResponse({
          diagnostic,
          error,
          refreshed: false,
          portfolioIds,
        });
      }

      if (!refreshToken) {
        return buildReconnectResponse(
          "Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden.",
        );
      }

      // ====================================================
      // Fallback: Token nur bei wahrscheinlichem Auth-Fehler erneuern
      // ====================================================

      const refreshed = await refreshParqetAccessToken(refreshToken);

      if (isInvalidRefresh(refreshed)) {
        return buildReconnectResponse(
          "Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden.",
        );
      }

      if (isTemporaryRefreshFailure(refreshed)) {
        return buildTemporaryAuthFailureResponse({
          refreshed: false,
          portfolioIds,
        });
      }

      if (!refreshed.ok) {
        return buildReconnectResponse("Parqet-Verbindung muss erneuert werden.");
      }

      accessToken = refreshed.accessToken;

      try {
        const result = await buildAssetView(accessToken);

        const response = NextResponse.json({
          ok: true,
          refreshed: true,
          requestedPortfolioIds: portfolioIds,
          ...result,
        });

        setParqetTokenCookies(response, {
          accessToken,
          refreshToken: refreshed.newRefreshToken,
          accessTokenExpiresInSeconds: refreshed.accessTokenExpiresInSeconds ?? null,
          refreshTokenExpiresInSeconds:
            refreshed.refreshTokenExpiresInSeconds ?? null,
        });

        return response;
      } catch (retryError) {
        return buildFailureResponse({
          diagnostic: classifyParqetApiError(retryError),
          error: retryError,
          refreshed: true,
          portfolioIds,
        });
      }
    }
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        message: "Assets route failed.",
        details: redactProviderErrorMessage(getErrorMessage(error)),
        apiBudget: ASSETS_API_BUDGET,
      },
      { status: 500 },
    );
  }
}

