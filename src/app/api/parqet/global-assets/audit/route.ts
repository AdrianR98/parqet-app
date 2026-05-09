import { NextResponse } from "next/server";
import { getCookieValue, refreshParqetAccessToken } from "../../../../../lib/parqet";
import { buildActivityContext } from "../../../../../lib/parqet-assets/build-activity-context";
import { runGlobalAssetPipelineAudit, type GlobalAssetAuditOptions } from "../../../../../lib/parqet/global-assets";
import type { ParqetActivityWithPortfolioContext } from "../../../../../lib/parqet/global-assets";

const FEATURE_FLAG = "ENABLE_GLOBAL_ASSET_AUDIT_ROUTES";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

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

function isEnabled(): boolean {
  return process.env[FEATURE_FLAG] === "true";
}

function getQueryOptions(url: URL): GlobalAssetAuditOptions {
  return {
    includeActivities: parseBoolean(url.searchParams.get("includeActivities"), true),
    includeAmounts: parseBoolean(url.searchParams.get("includeAmounts"), false),
    includePortfolioNames: parseBoolean(url.searchParams.get("includePortfolioNames"), false),
    includeActivityIds: parseBoolean(url.searchParams.get("includeActivityIds"), false),
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
    return NextResponse.json(emptyReport(options, "No access token found."), { status: 401 });
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
    if (!refreshToken) {
      return NextResponse.json(
        { ...emptyReport(options, "Global Asset audit route failed."), error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }

    const refreshed = await refreshParqetAccessToken(refreshToken);
    if (!refreshed.accessToken) {
      return NextResponse.json(emptyReport(options, "Access token expired and refresh failed."), { status: 401 });
    }

    accessToken = refreshed.accessToken;
    const report = await buildReport(accessToken);
    const response = NextResponse.json(report);

    response.cookies.set("parqet_access_token", accessToken, { httpOnly: true, sameSite: "lax", path: "/" });
    if (refreshed.newRefreshToken) {
      response.cookies.set("parqet_refresh_token", refreshed.newRefreshToken, { httpOnly: true, sameSite: "lax", path: "/" });
    }

    return response;
  }
}
