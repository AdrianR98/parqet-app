import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const useDashboardDataMock = vi.fn();

vi.mock("../../src/hooks/use-dashboard-data", () => ({
  useDashboardData: () => useDashboardDataMock(),
}));

vi.mock("../../src/components/dashboard/CollapsibleAssetTableSection", () => ({
  default: ({ title }: { title: string }) => React.createElement("section", null, title),
}));

vi.mock("../../src/components/dashboard/DataWarningsPanel", () => ({
  default: () => null,
}));

vi.mock("../../src/components/dashboard/HeroSection", () => ({
  default: () => React.createElement("section", null, "hero"),
}));

import DashboardPage from "../../src/app/(app)/dashboard/page";

describe("dashboard page silent revalidation", () => {
  it("does not render a visible refresh message or refresh button during background refresh", () => {
    useDashboardDataMock.mockReturnValue({
      selectedPortfolioIds: [],
      showWarningsPanel: false,
      consistencyReport: null,
      reconciliationWarnings: [],
      selectedPortfoliosMissingInLocalLoad: [],
      hasEmptyManualScopeIntersection: false,
      loadingAssets: false,
      refreshingAssets: true,
      hasCachedData: true,
      errorMessage: "",
      authRequired: false,
      startReconnect: vi.fn(),
      sortedActiveAssets: [],
      sortedClosedAssets: [],
      setShowWarningsPanel: vi.fn(),
    });

    const markup = renderToStaticMarkup(React.createElement(DashboardPage));

    expect(markup).not.toContain("Manuelle Aktualisierung läuft");
    expect(markup).not.toContain("Aktualisieren");
    expect(markup).not.toContain("<button");
  });
});
