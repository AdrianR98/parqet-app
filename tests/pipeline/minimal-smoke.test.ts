import { describe, expect, it } from "vitest";

const buildSyntheticActivityId = (portfolioId: string, activityId: string) =>
  `${portfolioId}:${activityId}`;

describe("pipeline test setup smoke", () => {
  it("handles a minimal synthetic identifier", () => {
    expect(buildSyntheticActivityId("portfolio_demo_1", "activity_demo_1")).toBe(
      "portfolio_demo_1:activity_demo_1",
    );
  });
});
