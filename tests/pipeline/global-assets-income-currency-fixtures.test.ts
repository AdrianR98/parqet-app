import { describe, expect, it } from "vitest";

import { createSyntheticActivity, runGlobalAssetPipeline, warningCodes } from "./global-assets-test-helpers";

describe("global asset dividend, fee/tax and currency fixtures", () => {
  it("dividend_net_only: keeps same-currency net dividend total", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_20",
        type: "dividend",
        datetime: "2025-05-01T10:00:00.000Z",
        isin: "DEMO00000001",
        amountNet: 12,
        currency: "EUR",
      }),
    ]);

    expect(aggregation.assets[0]?.totals.dividendsNet).toEqual({ amount: 12, currency: "EUR" });
    expect(aggregation.assets[0]?.status).toBe("closed");
  });

  it("dividend_gross_tax_fee: keeps current conservative behavior without implicit net derivation", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_21",
        type: "dividend",
        datetime: "2025-05-02T10:00:00.000Z",
        isin: "DEMO00000001",
        amount: 100,
        fee: 10,
        tax: 15,
        currency: "EUR",
      }),
    ]);

    expect(aggregation.assets[0]?.totals.dividendsNet).toBeNull();
    expect(aggregation.assets[0]?.totals.fees).toEqual({ amount: 10, currency: "EUR" });
    expect(aggregation.assets[0]?.totals.taxes).toEqual({ amount: 15, currency: "EUR" });
  });

  it("dividend_ambiguous_gross_net: preserves explicit net amount when both gross and net exist", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_22",
        type: "dividend",
        datetime: "2025-05-03T10:00:00.000Z",
        isin: "DEMO00000001",
        amount: 100,
        amountNet: 80,
        currency: "EUR",
      }),
    ]);

    expect(aggregation.assets[0]?.totals.dividendsNet).toEqual({ amount: 80, currency: "EUR" });
  });

  it("closed_position_with_dividend: keeps historical dividend total on closed position", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_23",
        type: "buy",
        datetime: "2025-05-04T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 10,
      }),
      createSyntheticActivity({
        activityId: "activity_demo_24",
        type: "sell",
        datetime: "2025-05-05T10:00:00.000Z",
        isin: "DEMO00000001",
        shares: 10,
      }),
      createSyntheticActivity({
        activityId: "activity_demo_25",
        type: "dividend",
        datetime: "2025-05-06T10:00:00.000Z",
        isin: "DEMO00000001",
        amountNet: 5,
        currency: "EUR",
      }),
    ]);

    expect(aggregation.assets[0]?.totals.quantity).toBe(0);
    expect(aggregation.assets[0]?.status).toBe("closed");
    expect(aggregation.assets[0]?.totals.dividendsNet).toEqual({ amount: 5, currency: "EUR" });
  });

  it("same_currency_totals: aggregates same-currency dividend net, fee and tax totals", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_26",
        type: "dividend",
        datetime: "2025-05-07T10:00:00.000Z",
        isin: "DEMO00000001",
        amountNet: 4,
        fee: 1,
        tax: 2,
        currency: "EUR",
      }),
      createSyntheticActivity({
        activityId: "activity_demo_27",
        type: "dividend",
        datetime: "2025-05-08T10:00:00.000Z",
        isin: "DEMO00000001",
        amountNet: 6,
        fee: 2,
        tax: 1,
        currency: "EUR",
      }),
    ]);

    expect(aggregation.assets[0]?.totals.dividendsNet).toEqual({ amount: 10, currency: "EUR" });
    expect(aggregation.assets[0]?.totals.fees).toEqual({ amount: 3, currency: "EUR" });
    expect(aggregation.assets[0]?.totals.taxes).toEqual({ amount: 3, currency: "EUR" });
  });

  it("mixed_currency_blocked: mixed activity currencies block same-currency totals", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_28",
        type: "dividend",
        datetime: "2025-05-09T10:00:00.000Z",
        isin: "DEMO00000001",
        amountNet: 4,
        currency: "EUR",
      }),
      createSyntheticActivity({
        activityId: "activity_demo_29",
        type: "dividend",
        datetime: "2025-05-10T10:00:00.000Z",
        isin: "DEMO00000001",
        amountNet: 6,
        currency: "USD",
      }),
    ]);

    expect(aggregation.summary.mixedCurrencyAssetCount).toBe(1);
    expect(warningCodes(aggregation.assets[0]?.warnings ?? [])).toContain("MIXED_CURRENCIES");
    expect(warningCodes(aggregation.assets[0]?.warnings ?? [])).toContain("TOTALS_BLOCKED_BY_MIXED_CURRENCIES");
    expect(aggregation.assets[0]?.totals.dividendsNet).toBeNull();
    expect(aggregation.assets[0]?.totals.fees).toBeNull();
    expect(aggregation.assets[0]?.totals.taxes).toBeNull();
  });

  it("missing_currency_blocked: amount fields without currency stay unset and warn", () => {
    const { normalization, aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_30",
        type: "dividend",
        datetime: "2025-05-11T10:00:00.000Z",
        isin: "DEMO00000001",
        amountNet: 7,
        currency: null,
        portfolioCurrency: null,
      }),
    ]);

    expect(warningCodes(normalization.warnings)).toContain("MISSING_CURRENCY");
    expect(warningCodes(normalization.warnings)).toContain("MONEY_FIELD_WITHOUT_CURRENCY");
    expect(aggregation.assets[0]?.totals.dividendsNet).toBeNull();
  });

  it("fees_taxes_clear: keeps same-currency fee and tax totals", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_31",
        type: "fees_taxes",
        datetime: "2025-05-12T10:00:00.000Z",
        isin: "DEMO00000001",
        fee: 3,
        tax: 2,
        currency: "EUR",
      }),
    ]);

    expect(aggregation.assets[0]?.totals.fees).toEqual({ amount: 3, currency: "EUR" });
    expect(aggregation.assets[0]?.totals.taxes).toEqual({ amount: 2, currency: "EUR" });
  });

  it("fees_taxes_ambiguous: amount-only fees_taxes does not infer fee/tax splits", () => {
    const { aggregation } = runGlobalAssetPipeline([
      createSyntheticActivity({
        activityId: "activity_demo_32",
        type: "fees_taxes",
        datetime: "2025-05-13T10:00:00.000Z",
        isin: "DEMO00000001",
        amount: 9,
        currency: "EUR",
      }),
    ]);

    expect(aggregation.assets[0]?.totals.fees).toBeNull();
    expect(aggregation.assets[0]?.totals.taxes).toBeNull();
  });
});
