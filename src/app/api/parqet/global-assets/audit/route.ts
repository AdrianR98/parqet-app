import { NextResponse } from "next/server";
import { getCookieValue, refreshParqetAccessToken } from "../../../../../lib/parqet";
import {
  buildActivityScanBudgetInfo,
  classifyParqetApiError,
  getErrorMessage,
  messageForDiagnostic,
  redactProviderErrorMessage,
  type ParqetApiDiagnostic,
} from "../../../../../lib/parqet-api-diagnostics";
import { buildActivityContext } from "../../../../../lib/parqet-assets/build-activity-context";
import {
  runGlobalAssetPipelineAudit,
  type GlobalAssetAuditAssetFilter,
  type GlobalAssetAuditOptions,
} from "../../../../../lib/parqet/global-assets";
import type { ParqetActivityWithPortfolioContext } from "../../../../../lib/parqet/global-assets";

const FEATURE_FLAG = "ENABLE_GLOBAL_ASSET_AUDIT_ROUTES";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 250;
const AUDIT_API_BUDGET = buildActivityScanBudgetInfo({
  activityFetchScope: "authorized_portfolios",
  responseFlagsReduceProviderCalls: false,
});

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return fallback;
}

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function normalizeAssetFilterValue(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function getAssetFilter(url: URL): GlobalAssetAuditAssetFilter | null {
  const explicitType = normalizeAssetFilterValue(url.searchParams.get("assetKeyType"))?.toLowerCase();
  const explicitValue = normalizeAssetFilterValue(url.searchParams.get("assetKeyValue"));

  if (explicitType === "isin" && explicitValue) {
    return { type: "isin", value: explicitValue };
  }

  const isin = normalizeAssetFilterValue(url.searchParams.get("isin"));
  return isin ? { type: "isin", value: isin } : null;
}

function isEnabled(): boolean {
  return process.env[FEATURE_FLAG] === "true";
}

function getQueryOptions(url: URL): GlobalAssetAuditOptions {
  return {
    includeActivities: parseBoolean(url.searchParams.get("includeActivities"), false),
    includeAssets: parseBoolean(url.searchParams.get("includeAssets"), true),
    includeAmounts: parseBoolean(url.searchParams.get("includeAmounts"), false),
    includePortfolioNames: parseBoolean(url.searchParams.get("includePortfolioNames"), false),
    includeActivityIds: parseBoolean(url.searchParams.get("includeActivityIds"), false),
    assetFilter: getAssetFilter(url),
    limit: parseLimit(url.searchParams.get("limit")),
  };
}

function getPortfolioIds(url: URL): string[] {
  const repeated = url.searchParams.getAll("portfolioId");
  const csv = url.searchParams.get("portfolioIds")?.split(",") ?? [];
  return Array.from(new Set([...repeated, ...csv].map((id) => id.trim()).filter(Boolean)));
}

function toContextualActivities(
  activityContext: Awaited<ReturnType<typeof buildActivityContext>>,
  requestedPortfolioIds: string[]
): ParqetActivityWithPortfolioContext[] {
  const selectedPortfolios = requestedPortfolioIds.length > 0
    ? activityContext.selectedPortfolios
    : activityContext.authorizedPortfolios;
  const portfolioById = new Map(selectedPortfolios.map((portfolio) => [portfolio.id, portfolio]));

  return activityContext.filteredActivities.flatMap((activity) => {
    const portfolioId = activity.portfolioId ?? null;
    if (!portfolioId) return [];

    const portfolio = portfolioById.get(portfolioId);

    return [{
      portfolioId,
      portfolioName: portfolio?.name ?? activityContext.portfolioNameById.get(portfolioId) ?? null,
      portfolioCurrency: portfolio?.currency ?? null,
      raw: activity,
    }];
  });
}

function emptyReport(options: GlobalAssetAuditOptions, note: string) {
  return runGlobalAssetPipelineAudit([], options, {
    sourceActivityCount: 0,
    selectedPortfolioCount: 0,
    portfolioFilterApplied: false,
    note,
  });
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

function buildFailedAuditResponse(options: GlobalAssetAuditOptions, diagnostic: ParqetApiDiagnostic, error: unknown) {
  return NextResponse.json(
    {
      ...emptyReport(options, messageForDiagnostic(diagnostic)),
      diagnostic,
      error: redactProviderErrorMessage(getErrorMessage(error)),
      apiBudget: AUDIT_API_BUDGET,
    },
    { status: getStatusForDiagnostic(diagnostic) }
  );
}

function buildDiagnosticResponse(options: GlobalAssetAuditOptions, diagnostic: ParqetApiDiagnostic) {
  return NextResponse.json(
    {
      ...emptyReport(options, messageForDiagnostic(diagnostic)),
      diagnostic,
      apiBudget: AUDIT_API_BUDGET,
    },
    { status: getStatusForDiagnostic(diagnostic) }
  );
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  }

  if (!isEnabled()) {
    return NextResponse.json(
      { ok: false, message: `${FEATURE_FLAG}=true is required for this local audit route.` },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const options = getQueryOptions(url);
  const requestedPortfolioIds = getPortfolioIds(url);
  const cookieHeader = req.headers.get("cookie") || "";
  let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
  const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

  if (!accessToken) {
    return buildDiagnosticResponse(options, { category: "missing_access_token" });
  }

  async function buildReport(currentAccessToken: string) {
    const initialIds = requestedPortfolioIds;
    const firstContext = await buildActivityContext(currentAccessToken, initialIds);
    const selectedIds = initialIds.length > 0
      ? initialIds
      : firstContext.authorizedPortfolios.map((portfolio) => portfolio.id);

    const activityContext = initialIds.length > 0
      ? firstContext
      : await buildActivityContext(currentAccessToken, selectedIds);

    const contextualActivities = toContextualActivities(activityContext, selectedIds);

    return {
      ...runGlobalAssetPipelineAudit(contextualActivities, options, {
        sourceActivityCount: contextualActivities.length,
        selectedPortfolioCount: selectedIds.length,
        portfolioFilterApplied: requestedPortfolioIds.length > 0,
        note: contextualActivities.length === 0 ? "No security activities available for the selected portfolios." : undefined,
      }),
      apiBudget: {
        ...AUDIT_API_BUDGET,
        activityFetchScope: requestedPortfolioIds.length > 0 ? "selected_portfolios" : "authorized_portfolios",
      },
    };
  }

  try {
    return NextResponse.json(await buildReport(accessToken));
  } catch (error) {
    const diagnostic = classifyParqetApiError(error);

    if (diagnostic.category !== "auth_error") {
      return buildFailedAuditResponse(options, diagnostic, error);
    }

    if (!refreshToken) {
      return buildFailedAuditResponse(options, diagnostic, error);
    }

    const refreshed = await refreshParqetAccessToken(refreshToken);
    if (!refreshed.accessToken) {
      return buildDiagnosticResponse(options, { category: "auth_refresh_failed" });
    }

    accessToken = refreshed.accessToken;

    try {
      const report = await buildReport(accessToken);
      const response = NextResponse.json(report);

      response.cookies.set("parqet_access_token", accessToken, { httpOnly: true, sameSite: "lax", path: "/" });
      if (refreshed.newRefreshToken) {
        response.cookies.set("parqet_refresh_token", refreshed.newRefreshToken, { httpOnly: true, sameSite: "lax", path: "/" });
      }

      return response;
    } catch (retryError) {
      const retryDiagnostic = classifyParqetApiError(retryError);
      return buildFailedAuditResponse(options, retryDiagnostic, retryError);
    }
  }
}
