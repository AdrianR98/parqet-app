"use client";

import {
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

export async function ensureParqetLocalBootstrap(): Promise<BootstrapStatus> {
  if (typeof window === "undefined") {
    return "failed";
  }

  const cache = loadDashboardCache();
  if (cache?.activityItems?.length || cache?.activeAssets?.length || cache?.closedAssets?.length) {
    return "already_ready";
  }

  const existingPromise = getGlobalBootstrapPromise();
  if (existingPromise) {
    return existingPromise;
  }

  const nextPromise = (async (): Promise<BootstrapStatus> => {
    try {
      const portfolioRes = await fetch("/api/parqet/portfolios");
      const portfolioText = await portfolioRes.text();
      const portfolioData: PortfoliosApiResponse = JSON.parse(portfolioText);
      if (!portfolioData.ok) {
        return portfolioData.authRequired ? "auth_required" : "failed";
      }

      const portfolios = portfolioData.portfolios?.items ?? [];
      if (portfolios.length === 0) {
        return "no_portfolios";
      }

      saveKnownPortfolios(portfolios);
      const resolvedScope = resolvePortfolioScope(loadPortfolioScope(), portfolios);
      if (resolvedScope.usedFallback) {
        savePortfolioScope(resolvedScope.scope);
      }

      const params = new URLSearchParams();
      for (const portfolioId of resolvedScope.selectedPortfolioIds) {
        params.append("portfolioId", portfolioId);
      }
      params.set("refresh", "1");

      const assetsRes = await fetch(`/api/parqet/assets?${params.toString()}`);
      const assetsText = await assetsRes.text();
      const assetsData: AssetsApiResponse = JSON.parse(assetsText);
      if (!assetsData.ok) {
        return assetsData.authRequired ? "auth_required" : "failed";
      }

      persistDashboardCacheWrite({
        response: assetsData,
        selectedPortfolioIds: resolvedScope.selectedPortfolioIds,
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
