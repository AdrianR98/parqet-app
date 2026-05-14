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
  getCookieValue,
  refreshParqetAccessToken,
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

  response.cookies.set("parqet_access_token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("parqet_refresh_token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
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
): ActivitiesAuditItem[] {
  return activityContext.correctedActivities
    .map((activity) => {
      const datetime = activity.datetime ?? "";
      const isin = (activity.isin ?? "").trim().toUpperCase();

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
        name: activity.name ?? activity.symbol ?? activity.wkn ?? isin,
        symbol: activity.symbol ?? null,
        wkn: activity.wkn ?? null,
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
    const portfolioIds = url.searchParams.getAll("portfolioId");
    const explicitRefresh = url.searchParams.get("refresh") === "1";

    if (portfolioIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "No portfolioId parameters provided.",
          apiBudget: ASSETS_API_BUDGET,
        },
        { status: 400 },
      );
    }

    const cookieHeader = req.headers.get("cookie") || "";

    let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
    const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

    if (!accessToken) {
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

      const activeAssets = enrichedAssets.filter(
        (asset: AssetSummary) => asset.netShares > CLOSED_POSITION_EPSILON,
      );

      const closedAssets = enrichedAssets.filter(
        (asset: AssetSummary) => asset.netShares <= CLOSED_POSITION_EPSILON,
      );

      const consistencyReport = buildConsistencyReport(enrichedAssets);
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
        assetCount: enrichedAssets.length,
        activeAssetCount: activeAssets.length,
        closedAssetCount: closedAssets.length,
        activeAssets,
        closedAssets,
        consistencyReport,
        reconciliationWarnings: activityContext.reconciliationWarnings,
        generatedAt,
        freshness: activityContext.freshness,
        activityItems: buildActivityItems(activityContext),
        globalAssetProductReadModel,
        apiBudget: ASSETS_API_BUDGET,
      };
    }

    // ========================================================
    // Erster Versuch mit aktuellem Access Token
    // ========================================================

    try {
      const result = await buildAssetView(accessToken);

      return NextResponse.json({
        ok: true,
        refreshed: false,
        requestedPortfolioIds: portfolioIds,
        ...result,
      });
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
        return buildFailureResponse({
          diagnostic,
          error,
          refreshed: false,
          portfolioIds,
        });
      }

      // ====================================================
      // Fallback: Token nur bei wahrscheinlichem Auth-Fehler erneuern
      // ====================================================

      const refreshed = await refreshParqetAccessToken(refreshToken);

      if (!refreshed.accessToken) {
        return buildReconnectResponse(
          "Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden.",
        );
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

        response.cookies.set("parqet_access_token", accessToken, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });

        if (refreshed.newRefreshToken) {
          response.cookies.set(
            "parqet_refresh_token",
            refreshed.newRefreshToken,
            {
              httpOnly: true,
              sameSite: "lax",
              path: "/",
            },
          );
        }

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
