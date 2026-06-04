import { afterEach, describe, expect, it, vi } from "vitest";

import {
  evaluateValuationInvariant,
  isDevDiagnosticsEnabled,
  logDevDiagnostic,
  logValuationInvariant,
} from "../../src/lib/debug/dev-diagnostics";

const originalNodeEnv = process.env.NODE_ENV;

describe("dev diagnostics helpers", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("is disabled in production", () => {
    process.env.NODE_ENV = "production";

    expect(isDevDiagnosticsEnabled()).toBe(false);
  });

  it("is enabled in development", () => {
    process.env.NODE_ENV = "development";

    expect(isDevDiagnosticsEnabled()).toBe(true);
  });

  it("detects valuation mismatches beyond tolerance", () => {
    const result = evaluateValuationInvariant({
      quantity: 33.142924,
      marketPrice: 77.95,
      marketValue: 2107.89,
    });

    expect(result.checked).toBe(true);
    expect(result.isConsistent).toBe(false);
    expect(result.expectedMarketValue).toBeCloseTo(2583.49, 2);
    expect(result.diff).toBeCloseTo(-475.60, 2);
  });

  it("passes valuation mismatches within tolerance", () => {
    const result = evaluateValuationInvariant({
      quantity: 10,
      marketPrice: 12.5,
      marketValue: 125.04,
    });

    expect(result.checked).toBe(true);
    expect(result.isConsistent).toBe(true);
  });

  it("logs only in development", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    process.env.NODE_ENV = "production";

    logDevDiagnostic("scope", "test_stage", {
      selectedPortfolioIdsCount: 2,
    });

    expect(infoSpy).not.toHaveBeenCalled();

    process.env.NODE_ENV = "development";
    logDevDiagnostic("scope", "test_stage_dev", {
      selectedPortfolioIdsCount: 2,
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("emits invariant_failed warnings for mismatches", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.NODE_ENV = "development";

    const result = logValuationInvariant("view_model:asset", {
      isin: "IE00B8GKDB10",
      quantity: 86.6166,
      marketPrice: 77.95,
      marketValue: 6271.91,
      remainingCostBasis: 2314.42,
      unrealizedPnL: 3957.49,
      valuationSourceKind: "market_data_db",
    });

    expect(result.checked).toBe(true);
    expect(result.isConsistent).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

