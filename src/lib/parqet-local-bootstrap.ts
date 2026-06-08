"use client";

import {
  loadKnownPortfolios,
  loadPortfolioScope,
  resolvePortfolioScope,
  saveKnownPortfolios,
  savePortfolioScope,
} from "./app-settings";
import { loadDashboardCache } from "./dashboard-cache";
import { resolveGlobalAssetProductGuardEnabled } from "./dashboard-helpers";
import { persistDashboardCacheWrite } from "./dashboard-cache-writer";
import type { AssetsApiResponse, PortfoliosApiResponse } from "./types";

const BOOTSTRAP_PROMISE_KEY = "__assettraceParqetLocalBootstrapPromise";

type BootstrapStatus =
  | "already_ready"
  | "bootstrapped"
  | "no_portfolios"
  | "auth_required"
  | "failed";

function getGlobalBootstrapPromise(): Promise<BootstrapStatus> | null {
  if (typeof window === "undefined") return null;
  const scope = window as Window & { [BOOTSTRAP_PROMISE_KEY]?: Promise<BootstrapStatus> };
  return scope[BOOTSTRAP_PROMISE_KEY] ?? null;
}

function setGlobalBootstrapPromise(promise: Promise<BootstrapStatus> | null) {
  if (typeof window === "undefined") return;
  const scope = window as Window & { [BOOTSTRAP_PROMISE_KEY]?: Promise<BootstrapStatus> };
  if (promise) {
    scope[BOOTSTRAP_PROMISE_KEY] = promise;
    return;
  }
  delete scope[BOOTSTRAP_PROMISE_KEY];
}

export function buildParqetBootstrapAssetsUrl(
  portfolioIds: string[],
  explicitRefresh = false,
): string {
  const params = new URLSearchParams();

  for (const portfolioId of portfolioIds) {
    params.append("portfolioId", portfolioId);
  }

  if (explicitRefresh) {
    params.set("refresh", "1");
  }

  return `/api/parqet/assets?${params.toString()}`;
}

export function resolveParqetBootstrapScope(input: {
  knownPortfolios: NonNullable<PortfoliosApiResponse["portfolios"]>["items"];
  cachedSelectedPortfolioIds: string[];
}): string[] {
  if (input.knownPortfolios.length > 0) {
    const resolvedScope = resolvePortfolioScope(
      loadPortfolioScope(),
      input.knownPortfolios,
    );

    if (resolvedScope.usedFallback) {
      savePortfolioScope(resolvedScope.scope);
    }

    return resolvedScope.selectedPortfolioIds;
  }

  return [...new Set(input.cachedSelectedPortfolioIds.filter(Boolean))];
}

function hasUsableBootstrapData(data: AssetsApiResponse): boolean {
  if (data.authRequired) {
    return false;
  }

  if (data.freshness?.present === false) {
    return false;
  }

  return (
    (data.activityItems?.length ?? 0) > 0 ||
    (data.activeAssets?.length ?? 0) > 0 ||
    (data.closedAssets?.length ?? 0) > 0
  );
}

export async function ensureParqetLocalBootstrap(): Promise<BootstrapStatus> {
  if (typeof window === "undefined") {
    return "failed";
  }

  const cache = loadDashboardCache();
  if (cache?.activityItems?.length || cache?.activeAssets?.length || cache?.closedAssets?.length) {
    return "already_ready";
  }

   const knownPortfolios = loadKnownPortfolios();
   const selectedPortfolioIds = resolveParqetBootstrapScope({
    knownPortfolios,
    cachedSelectedPortfolioIds: cache?.selectedPortfolioIds ?? [],
   });

  const existingPromise = getGlobalBootstrapPromise();
  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = (async (): Promise<BootstrapStatus> => {
    try {
      if (selectedPortfolioIds.length > 0) {
        const localAssetsRes = await fetch(
          buildParqetBootstrapAssetsUrl(selectedPortfolioIds, false),
        );
        const localAssetsText = await localAssetsRes.text();
        const localAssetsData: AssetsApiResponse = JSON.parse(localAssetsText);
        if (localAssetsData.ok && hasUsableBootstrapData(localAssetsData)) {
          persistDashboardCacheWrite({
            response: localAssetsData,
            selectedPortfolioIds,
            guardEnabled: resolveGlobalAssetProductGuardEnabled(),
          });

          return "bootstrapped";
        }

        if (localAssetsData.authRequired) {
          return "auth_required";
        }
      }

      let providerPortfolios = knownPortfolios;
      let providerSelectedPortfolioIds = selectedPortfolioIds;

      if (providerPortfolios.length === 0) {
        const portfolioRes = await fetch("/api/parqet/portfolios");
        const portfolioText = await portfolioRes.text();
        const portfolioData: PortfoliosApiResponse = JSON.parse(portfolioText);
        if (!portfolioData.ok) {
          return portfolioData.authRequired ? "auth_required" : "failed";
        }

        providerPortfolios = portfolioData.portfolios?.items ?? [];
        if (providerPortfolios.length === 0) {
          return "no_portfolios";
        }

        saveKnownPortfolios(providerPortfolios);
        providerSelectedPortfolioIds = resolveParqetBootstrapScope({
          knownPortfolios: providerPortfolios,
          cachedSelectedPortfolioIds: cache?.selectedPortfolioIds ?? [],
        });
      }

      if (providerSelectedPortfolioIds.length === 0) {
        return "no_portfolios";
      }

      const assetsRes = await fetch(
        buildParqetBootstrapAssetsUrl(providerSelectedPortfolioIds, true),
      );
      const assetsText = await assetsRes.text();
      const assetsData: AssetsApiResponse = JSON.parse(assetsText);
      if (!assetsData.ok) {
        return assetsData.authRequired ? "auth_required" : "failed";
      }

      persistDashboardCacheWrite({
        response: assetsData,
        selectedPortfolioIds: providerSelectedPortfolioIds,
        guardEnabled: resolveGlobalAssetProductGuardEnabled(),
      });

      return "bootstrapped";
    } catch {
      return "failed";
    } finally {
      setGlobalBootstrapPromise(null);
    }
  })();

  setGlobalBootstrapPromise(nextPromise);
  return nextPromise;
}
