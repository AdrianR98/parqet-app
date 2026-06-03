import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  normalizeLatestMarketPriceSnapshotsByIsin,
} from "../../src/lib/market-data/service";
import type { AssetLatestMarketPriceSnapshot } from "../../src/lib/market-data/db/types-core";

describe("market-data service snapshot normalization", () => {
  it("normalizes composite repository keys to raw isin keys", () => {
    const snapshotsByCompositeKey: Record<string, AssetLatestMarketPriceSnapshot> = {
      "isin:IE00B8GKDB10": {
        assetId: "asset_demo_1",
        assetKeyType: "isin",
        assetKeyValue: "IE00B8GKDB10",
        isin: "IE00B8GKDB10",
        provider: "yfinance",
        priceAmount: 77.949997,
        currency: "EUR",
        priceDate: "2026-06-03",
        priceTimestamp: "2026-06-03T17:00:00.000Z",
        updatedAt: "2026-06-03T18:00:00.000Z",
      },
    };

    const normalized = normalizeLatestMarketPriceSnapshotsByIsin(
      snapshotsByCompositeKey,
    );

    expect(Object.keys(normalized)).toEqual(["IE00B8GKDB10"]);
    expect(normalized.IE00B8GKDB10?.priceAmount).toBe(77.949997);
  });
});
