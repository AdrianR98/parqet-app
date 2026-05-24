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
import type { ActivitiesAuditItem, AssetSummary } from "../../../../lib/types";
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
import { loadAssetMetadataByIsin } from "../../../../lib/parqet-assets/metadata";
import { buildConsistencyReport } from "../../../../lib/parqet-assets/consistency";
import { buildCorrectedAssets } from "../../../../lib/parqet-assets/build-corrected-assets";
import { resolveAssetDisplay } from "../../../../lib/metadata-utils";
import { buildGlobalAssetProductReadModelFromActivityContext } from "../../../../lib/parqet/global-assets/coexistence";
import {
  chooseCuratedDisplayName,
  getMarketInstrumentMetadataByIsins,
  isMeaningfulInstrumentName,
  MarketDataRepositoryError,
} from "../../../../lib/market-data/db/repository";
import type { DbMarketInstrumentMetadata } from "../../../../lib/market-data/db/types-core";

const CLOSED_POSITION_EPSILON = 1e-8;
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
): ActivitiesAuditItem[] {
  return activityContext.correctedActivities
    .map((activity) => {
      const datetime = activity.datetime ?? "";
      const isin = (activity.isin ?? "").trim().toUpperCase();
      const marketMetadata = marketMetadataByIsin[isin];
      const curatedName = marketMetadata
        ? chooseCuratedDisplayName(marketMetadata, activity.name ?? null)
        : null;
      const curatedWkn = marketMetadata?.wkn?.trim() || null;

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
          isMeaningfulInstrumentName(curatedName, isin) ? curatedName : activity.name ?? activity.symbol ?? activity.wkn ?? isin,
        symbol: activity.symbol ?? null,
        wkn: activity.wkn ?? curatedWkn ?? null,
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

function isWeakAssetType(value: string | null | undefined): boolean {
  const normalized = normalizeWeakText(value)?.toLowerCase() ?? "";
  return !normalized || normalized === "unknown" || normalized === "other" || normalized === "n/a";
}

function isWeakCurrency(value: string | null | undefined): boolean {
  const normalized = normalizeWeakText(value)?.toUpperCase() ?? "";
  return !normalized || normalized === "UNKNOWN" || normalized === "N/A";
}

function applyMarketInstrumentMetadataOverlay(
  asset: AssetSummary,
  marketMetadataByIsin: Record<string, DbMarketInstrumentMetadata>,
): AssetSummary {
  const marketMetadata = marketMetadataByIsin[asset.isin];

  if (!marketMetadata) {
    return asset;
  }

  const curatedDisplayName = normalizeWeakText(marketMetadata.displayName);
  const curatedName = chooseCuratedDisplayName(
    marketMetadata,
    asset.displayName ?? asset.name ?? null,
  );
  const curatedWkn = normalizeWeakText(marketMetadata.wkn);
  const curatedAssetType = normalizeWeakText(marketMetadata.assetType);
  const curatedCurrency = normalizeWeakText(marketMetadata.currency)?.toUpperCase() ?? null;
  const metadataSource = normalizeWeakText(marketMetadata.metadataSource);
  const metadataUpdatedAt = normalizeWeakText(marketMetadata.metadataUpdatedAt);
  const nameSource = normalizeWeakText(marketMetadata.nameSource);
  const displayNameSource = normalizeWeakText(marketMetadata.displayNameSource);

  const currentAssetType =
    normalizeWeakText(asset.externalMetadata?.assetType) ??
    normalizeWeakText(asset.metadata?.assetType) ??
    normalizeWeakText(asset.assetMeta?.assetType);
  const currentCurrency =
    normalizeWeakText(asset.externalMetadata?.currency) ??
    normalizeWeakText(asset.metadata?.currency) ??
    normalizeWeakText(asset.assetMeta?.currency);

  const shouldApplyName = isMeaningfulInstrumentName(curatedName, asset.isin);
  const shouldApplyAssetType = Boolean(curatedAssetType) && isWeakAssetType(currentAssetType);
  const shouldApplyCurrency = Boolean(curatedCurrency) && isWeakCurrency(currentCurrency);

  const existingWkn = normalizeWeakText(asset.wkn);

  return {
    ...asset,
    name: shouldApplyName ? curatedName : asset.name,
    assetName: shouldApplyName ? curatedName : asset.assetName,
    displayName: shouldApplyName ? (curatedDisplayName ?? curatedName) : asset.displayName,
    title: shouldApplyName ? curatedName : asset.title,
    curatedName: shouldApplyName ? curatedName : asset.curatedName ?? null,
    wkn: existingWkn ?? curatedWkn ?? asset.wkn,
    metadataSource: metadataSource ?? asset.metadataSource ?? null,
    nameSource: nameSource ?? asset.nameSource ?? null,
    displayNameSource: displayNameSource ?? asset.displayNameSource ?? null,
    metadataUpdatedAt: metadataUpdatedAt ?? asset.metadataUpdatedAt ?? null,
    externalMetadata: {
      ...(asset.externalMetadata ?? {}),
      curatedName: shouldApplyName ? curatedName : asset.externalMetadata?.curatedName ?? null,
      name: shouldApplyName ? curatedName : asset.externalMetadata?.name ?? asset.name ?? null,
      displayName: shouldApplyName ? (curatedDisplayName ?? curatedName) : asset.externalMetadata?.displayName ?? asset.displayName ?? null,
      assetName: shouldApplyName ? curatedName : asset.externalMetadata?.assetName ?? asset.assetName ?? null,
      title: shouldApplyName ? curatedName : asset.externalMetadata?.title ?? asset.title ?? null,
      wkn: existingWkn ?? curatedWkn ?? asset.externalMetadata?.wkn ?? null,
      assetType: shouldApplyAssetType ? curatedAssetType : asset.externalMetadata?.assetType ?? null,
      currency: shouldApplyCurrency ? curatedCurrency : asset.externalMetadata?.currency ?? null,
      metadataSource: metadataSource ?? asset.externalMetadata?.metadataSource ?? null,
      nameSource: nameSource ?? asset.externalMetadata?.nameSource ?? null,
      displayNameSource:
        displayNameSource ?? asset.externalMetadata?.displayNameSource ?? null,
      metadataUpdatedAt: metadataUpdatedAt ?? asset.externalMetadata?.metadataUpdatedAt ?? null,
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

      const metadataByIsin = await loadAssetMetadataByIsin(
        correctedAssets.map((asset: AssetSummary) => asset.isin),
      );

      let marketMetadataByIsin: Record<string, DbMarketInstrumentMetadata> = {};
      try {
        marketMetadataByIsin = await getMarketInstrumentMetadataByIsins(
          correctedAssets.map((asset: AssetSummary) => asset.isin),
        );
      } catch (error) {
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

      const enrichedAssets: AssetSummary[] = correctedAssets.map(
        (asset: AssetSummary) => {
          const metadata = metadataByIsin[asset.isin];
          const resolvedDisplay = resolveAssetDisplay({
            isin: asset.isin,
            metadata,
            activity: asset,
          });

          return {
            ...asset,
            name: resolvedDisplay.name,

            assetName: asset.assetName ?? metadata?.name ?? null,
            displayName: asset.displayName ?? metadata?.name ?? null,
            title: asset.title ?? metadata?.name ?? null,

            symbol: resolvedDisplay.symbol,
            ticker: resolvedDisplay.ticker,
            tickerSymbol: resolvedDisplay.tickerSymbol,
            wkn: resolvedDisplay.wkn,

            externalMetadata: {
              ...(asset.externalMetadata ?? {}),
              ...(metadata ?? {}),
              metadataSource: resolvedDisplay.source,
              subtitle: resolvedDisplay.subtitle,
            },
          };
        },
      );

      const assetsWithMarketMetadata: AssetSummary[] = enrichedAssets.map((asset) =>
        applyMarketInstrumentMetadataOverlay(asset, marketMetadataByIsin),
      );

      const activeAssets = assetsWithMarketMetadata.filter(
        (asset: AssetSummary) => asset.netShares > CLOSED_POSITION_EPSILON,
      );

      const closedAssets = assetsWithMarketMetadata.filter(
        (asset: AssetSummary) => asset.netShares <= CLOSED_POSITION_EPSILON,
      );

      const consistencyReport = buildConsistencyReport(assetsWithMarketMetadata);
      const generatedAt = new Date().toISOString();
      const globalAssetProductReadModel =
        buildGlobalAssetProductReadModelFromActivityContext({
          activityContext,
          requestedPortfolioIds: portfolioIds,
          generatedAt,
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
        generatedAt,
        freshness: activityContext.freshness,
        activityItems: buildActivityItems(activityContext, marketMetadataByIsin),
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
