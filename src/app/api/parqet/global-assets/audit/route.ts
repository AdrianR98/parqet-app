import { NextResponse } from "next/server";
import { getCookieValue, refreshParqetAccessToken } from "../../../../../lib/parqet";
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

type AuditDiagnostic = {
  category: "missing_access_token" | "auth_refresh_failed" | "rate_limit" | "auth_error" | "pipeline_error";
  retryAfterSeconds?: number | null;
};

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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isLikelyAuthError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes("(401)") ||
    message.includes(" 401 ") ||
    message.includes("401:") ||
    message.toLowerCase().includes("unauthorized")
  );
}

function getRetryAfterSeconds(message: string): number | null {
  const match = message.match(/try again in\s+(\d+)\s+seconds/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function redactErrorMessage(message: string): string {
  return message
    .replace(/portfolio [A-Za-z0-9_-]+/g, "portfolio [redacted]")
    .replace(/portfolios\/[A-Za-z0-9_-]+/g, "portfolios/[redacted]")
    .replace(/hld_[A-Za-z0-9_-]+/g, "hld_[redacted]")
    .replace(/cpa_[A-Za-z0-9_-]+/g, "cpa_[redacted]")
    .slice(0, 500);
}

function classifyError(error: unknown): AuditDiagnostic {
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (message.includes("(429)") || lowerMessage.includes("rate limit")) {
    return { category: "rate_limit", retryAfterSeconds: getRetryAfterSeconds(message) };
  }

  if (isLikelyAuthError(error)) {
    return { category: "auth_error" };
  }

  return { category: "pipeline_error" };
}

function noteForDiagnostic(diagnostic: AuditDiagnostic): string {
  switch (diagnostic.category) {
    case "missing_access_token":
      return "No access token found.";
    case "auth_refresh_failed":
      return "Access token expired and refresh failed.";
    case "rate_limit":
      return "Parqet rate limit reached. Retry later before running another local audit.";
    case "auth_error":
      return "Global Asset audit authorization failed.";
    case "pipeline_error":
      return "Global Asset audit route failed before auth refresh.";
  }
}

function buildFailedAuditResponse(options: GlobalAssetAuditOptions, diagnostic: AuditDiagnostic, error: unknown, status: number) {
  return NextResponse.json(
    {
      ...emptyReport(options, noteForDiagnostic(diagnostic)),
      diagnostic,
      error: redactErrorMessage(getErrorMessage(error)),
    },
    { status }
  );
}

function buildDiagnosticResponse(options: GlobalAssetAuditOptions, diagnostic: AuditDiagnostic, status: number) {
  return NextResponse.json(
    {
      ...emptyReport(options, noteForDiagnostic(diagnostic)),
      diagnostic,
    },
    { status }
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
    return buildDiagnosticResponse(options, { category: "missing_access_token" }, 401);
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

    return runGlobalAssetPipelineAudit(contextualActivities, options, {
      sourceActivityCount: contextualActivities.length,
      selectedPortfolioCount: selectedIds.length,
      portfolioFilterApplied: requestedPortfolioIds.length > 0,
      note: contextualActivities.length === 0 ? "No security activities available for the selected portfolios." : undefined,
    });
  }

  try {
    return NextResponse.json(await buildReport(accessToken));
  } catch (error) {
    const diagnostic = classifyError(error);

    if (diagnostic.category !== "auth_error") {
      return buildFailedAuditResponse(options, diagnostic, error, diagnostic.category === "rate_limit" ? 429 : 500);
    }

    if (!refreshToken) {
      return buildFailedAuditResponse(options, diagnostic, error, 401);
    }

    const refreshed = await refreshParqetAccessToken(refreshToken);
    if (!refreshed.accessToken) {
      return buildDiagnosticResponse(options, { category: "auth_refresh_failed" }, 401);
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
      const retryDiagnostic = classifyError(retryError);
      return buildFailedAuditResponse(options, retryDiagnostic, retryError, retryDiagnostic.category === "rate_limit" ? 429 : 500);
    }
  }
}
