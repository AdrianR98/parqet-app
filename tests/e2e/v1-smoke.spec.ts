import { expect, test, type Page, type Request } from "@playwright/test";

const DASHBOARD_CACHE_KEY = "parqet-dashboard-cache-v2";
const KNOWN_PORTFOLIOS_STORAGE_KEY = "assettrace-known-portfolios-v1";
const PORTFOLIO_SCOPE_STORAGE_KEY = "assettrace-portfolio-scope-v1";
const SYNTHETIC_LOADED_AT = "2026-05-01T10:15:00.000Z";

const HYDRATION_FAILURE_PATTERNS = [
  /Hydration failed/i,
  /server rendered text didn't match the client/i,
  /server rendered HTML didn't match the client/i,
  /Encountered a script tag while rendering React component/i,
];

const LOCAL_SMOKE_ROUTES = [
  "/dashboard",
  "/settings",
  "/activities",
  "/timeline",
  "/reports",
  "/assets/synthetic-smoke-asset?id=SYNTHETIC-TEST-ASSET",
] as const;

const API_BUDGET_ROUTES = [
  "/settings",
  "/dashboard",
  "/activities",
  "/timeline",
  "/reports",
  "/assets/synthetic-smoke-asset?id=SYNTHETIC-TEST-ASSET",
] as const;

type FailureMonitor = {
  assertNoFailures: () => void;
};

type ProviderRouteMonitor = {
  assertNoUnexpectedRequests: () => void;
};

function createFailureMonitor(page: Page): FailureMonitor {
  const failures: string[] = [];

  page.on("console", (message) => {
    const text = message.text();

    if (
      message.type() === "error" &&
      HYDRATION_FAILURE_PATTERNS.some((pattern) => pattern.test(text))
    ) {
      failures.push(`console error: ${text}`);
    }
  });

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  return {
    assertNoFailures() {
      expect(failures).toEqual([]);
    },
  };
}

function createProviderRouteMonitor(page: Page): ProviderRouteMonitor {
  const unexpectedRequests: string[] = [];

  page.on("request", (request) => {
    if (isUnexpectedProviderRoute(request)) {
      unexpectedRequests.push(request.url());
    }
  });

  return {
    assertNoUnexpectedRequests() {
      expect(unexpectedRequests).toEqual([]);
    },
  };
}

function isUnexpectedProviderRoute(request: Request): boolean {
  const url = new URL(request.url());

  return (
    url.pathname === "/api/parqet/assets" ||
    url.pathname === "/api/parqet/activities"
  );
}

async function visitSmokeRoute(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
  await page.waitForLoadState("load");

  // Bounded smoke-test hydration window for late React/Next boot warnings.
  await page.waitForTimeout(250);
}

function createSyntheticActivity(index: number) {
  const portfolioId = index % 2 === 0 ? "synthetic-portfolio-alpha" : "synthetic-portfolio-beta";
  const portfolioName = index % 2 === 0 ? "Synthetic Alpha Portfolio" : "Synthetic Beta Portfolio";
  const typeCycle = ["buy", "sell", "dividend", "transfer_in", "transfer_out"] as const;
  const type = typeCycle[index % typeCycle.length];
  const day = String((index % 25) + 1).padStart(2, "0");
  const month = String((index % 4) + 1).padStart(2, "0");
  const fakeIsin = `XSYNTH${String(index).padStart(6, "0")}`;

  return {
    id: `synthetic-activity-${String(index).padStart(2, "0")}`,
    datetime: `2026-${month}-${day}T09:00:00.000Z`,
    year: 2026,
    monthKey: `2026-${month}`,
    monthLabel: `Synthetic Monat ${month}`,
    portfolioId,
    portfolioName,
    isin: fakeIsin,
    name: index === 7 ? "Synthetic Search Needle Fund" : `Synthetic Smoke Asset ${index}`,
    symbol: `SYN${index}`,
    wkn: `SYN${String(index).padStart(3, "0")}`,
    type,
    rawType: type,
    shares: index + 1,
    price: 10 + index,
    amount: (index + 1) * (10 + index),
    amountNet: (index + 1) * (10 + index) - 1,
    fee: index % 3 === 0 ? 1 : null,
    tax: index % 5 === 0 ? 0.5 : null,
    note: null,
    warningMessages: index % 11 === 0 ? ["Synthetic data quality note"] : [],
    hasOverrides: false,
    overrideFlags: {},
    overrideCount: 0,
  };
}

function createSyntheticAsset(isin: string, name: string) {
  return {
    isin,
    portfolioIds: ["synthetic-portfolio-alpha", "synthetic-portfolio-beta"],
    portfolioNames: ["Synthetic Alpha Portfolio", "Synthetic Beta Portfolio"],
    portfolioBreakdown: [
      {
        portfolioId: "synthetic-portfolio-alpha",
        portfolioName: "Synthetic Alpha Portfolio",
        netShares: 12,
        remainingCostBasis: 1200,
        avgBuyPrice: 100,
        latestTradePrice: 104,
        marketPrice: 105,
        positionValue: 1260,
        unrealizedPnL: 60,
        totalDividendNet: 18,
      },
      {
        portfolioId: "synthetic-portfolio-beta",
        portfolioName: "Synthetic Beta Portfolio",
        netShares: 8,
        remainingCostBasis: 840,
        avgBuyPrice: 105,
        latestTradePrice: 107,
        marketPrice: 108,
        positionValue: 864,
        unrealizedPnL: 24,
        totalDividendNet: 12,
      },
    ],
    activityCount: 20,
    buyCount: 12,
    sellCount: 3,
    dividendCount: 5,
    totalBoughtShares: 24,
    totalSoldShares: 4,
    netShares: 20,
    totalInvestedGross: 2040,
    remainingCostBasis: 2040,
    avgBuyPrice: 102,
    latestTradePrice: 107,
    marketPrice: 108,
    marketPriceAt: SYNTHETIC_LOADED_AT,
    marketPriceSource: "synthetic-fixture",
    positionValue: 2124,
    unrealizedPnL: 84,
    totalDividendNet: 30,
    latestActivityAt: SYNTHETIC_LOADED_AT,
    name,
    symbol: "SYN",
    ticker: "SYN",
    tickerSymbol: "SYN",
    wkn: "SYN001",
  };
}

const SYNTHETIC_KNOWN_PORTFOLIOS = [
  {
    id: "synthetic-portfolio-alpha",
    name: "Synthetic Alpha Portfolio",
    currency: "EUR",
    createdAt: "2026-01-01T00:00:00.000Z",
    distinctBrokers: ["Synthetic Broker A"],
  },
  {
    id: "synthetic-portfolio-beta",
    name: "Synthetic Beta Portfolio",
    currency: "EUR",
    createdAt: "2026-01-02T00:00:00.000Z",
    distinctBrokers: ["Synthetic Broker B"],
  },
];

const SYNTHETIC_ACTIVITIES = Array.from({ length: 36 }, (_, index) =>
  createSyntheticActivity(index + 1),
);

const SYNTHETIC_ACTIVE_ASSETS = [
  createSyntheticAsset("XSYNTH000001", "Synthetic Report Asset One"),
  createSyntheticAsset("XSYNTH000002", "Synthetic Report Asset Two"),
];

const SYNTHETIC_DASHBOARD_CACHE = {
  activeAssets: SYNTHETIC_ACTIVE_ASSETS,
  closedAssets: [],
  rawActivityCount: SYNTHETIC_ACTIVITIES.length,
  filteredActivityCount: SYNTHETIC_ACTIVITIES.length,
  assetCount: SYNTHETIC_ACTIVE_ASSETS.length,
  activeAssetCount: SYNTHETIC_ACTIVE_ASSETS.length,
  closedAssetCount: 0,
  consistencyReport: null,
  reconciliationWarnings: [],
  generatedAt: SYNTHETIC_LOADED_AT,
  lastUpdatedAt: SYNTHETIC_LOADED_AT,
  selectedPortfolioIds: ["synthetic-portfolio-alpha", "synthetic-portfolio-beta"],
  freshness: {
    present: true,
    loadedAt: SYNTHETIC_LOADED_AT,
    updatedAt: SYNTHETIC_LOADED_AT,
    status: "fresh",
    source: "snapshot",
    refreshStatus: "idle",
    stale: false,
    scope: {
      portfolioCount: 2,
      fingerprint: "synthetic-fixture-scope",
    },
    lastRefreshErrorCategory: null,
  },
  activityItems: SYNTHETIC_ACTIVITIES,
};

const SYNTHETIC_GUARDED_PRODUCT_READ_MODEL = {
  metadata: {
    readModelId: "synthetic-guarded-product-read-model",
    snapshotId: "synthetic-snapshot-id",
    generatedAt: SYNTHETIC_LOADED_AT,
    sourceType: "local_snapshot",
    sourceScope: "selected_portfolios",
    freshnessAt: SYNTHETIC_LOADED_AT,
    freshnessState: "fresh",
    scopeState: "scope_match",
    selectedPortfolioIds: ["synthetic-portfolio-alpha", "synthetic-portfolio-beta"],
    confidence: "medium",
    warnings: [],
    blockedMetrics: [],
    valueClassification: "preliminary",
    providerRequestCount: 0,
  },
  assets: [
    {
      identity: {
        assetKey: { type: "isin", value: "XSYNTH000001" },
        stableKey: "isin:XSYNTH000001",
        compatibilityIsin: "XSYNTH000001",
      },
      display: {
        displayName: "Synthetic Guarded Product One",
        subtitle: null,
        symbol: "SGP1",
        wkn: "SGP001",
      },
      status: "active",
      quantity: 999,
      quantityValueClassification: "app_calculated",
      marketValue: {
        amount: 999999,
        currency: "EUR",
        valueClassification: "app_calculated",
        blockedMetrics: [],
      },
      costBasis: {
        amount: 888888,
        currency: "EUR",
        valueClassification: "app_calculated",
        blockedMetrics: [],
      },
      unrealizedPnL: {
        amount: 777777,
        currency: "EUR",
        valueClassification: "app_calculated",
        blockedMetrics: [],
      },
      dividendsNet: {
        amount: 30,
        currency: "EUR",
        valueClassification: "app_calculated",
        blockedMetrics: [],
      },
      fees: {
        amount: null,
        currency: null,
        valueClassification: "none",
        blockedMetrics: [],
      },
      taxes: {
        amount: null,
        currency: null,
        valueClassification: "none",
        blockedMetrics: [],
      },
      warnings: [],
      blockedMetrics: [],
      confidence: "medium",
      valueClassification: "preliminary",
      sourceType: "local_snapshot",
      sourceScope: "selected_portfolios",
      freshnessState: "fresh",
      scopeState: "scope_match",
      portfolioBreakdown: [
        {
          portfolioId: "synthetic-portfolio-alpha",
          portfolioName: "Synthetic Guarded Alpha Portfolio",
          status: "active",
          quantity: 400,
          marketValue: {
            amount: 400000,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          costBasis: {
            amount: 300000,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          unrealizedPnL: {
            amount: 100000,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          dividendsNet: {
            amount: 20,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          fees: {
            amount: null,
            currency: null,
            valueClassification: "none",
            blockedMetrics: [],
          },
          taxes: {
            amount: null,
            currency: null,
            valueClassification: "none",
            blockedMetrics: [],
          },
          warnings: [],
          blockedMetrics: [],
          confidence: "medium",
        },
        {
          portfolioId: "synthetic-portfolio-beta",
          portfolioName: "Synthetic Guarded Beta Portfolio",
          status: "active",
          quantity: 599,
          marketValue: {
            amount: 599999,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          costBasis: {
            amount: 588888,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          unrealizedPnL: {
            amount: 11111,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          dividendsNet: {
            amount: 10,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          fees: {
            amount: null,
            currency: null,
            valueClassification: "none",
            blockedMetrics: [],
          },
          taxes: {
            amount: null,
            currency: null,
            valueClassification: "none",
            blockedMetrics: [],
          },
          warnings: [],
          blockedMetrics: [],
          confidence: "medium",
        },
      ],
      latestActivityAt: SYNTHETIC_LOADED_AT,
    },
    {
      identity: {
        assetKey: { type: "isin", value: "XSYNTH000002" },
        stableKey: "isin:XSYNTH000002",
        compatibilityIsin: "XSYNTH000002",
      },
      display: {
        displayName: "Synthetic Guarded Product Two",
        subtitle: null,
        symbol: "SGP2",
        wkn: "SGP002",
      },
      status: "active",
      quantity: 888,
      quantityValueClassification: "app_calculated",
      marketValue: {
        amount: 888888,
        currency: "EUR",
        valueClassification: "app_calculated",
        blockedMetrics: [],
      },
      costBasis: {
        amount: 777777,
        currency: "EUR",
        valueClassification: "app_calculated",
        blockedMetrics: [],
      },
      unrealizedPnL: {
        amount: 111111,
        currency: "EUR",
        valueClassification: "app_calculated",
        blockedMetrics: [],
      },
      dividendsNet: {
        amount: 30,
        currency: "EUR",
        valueClassification: "app_calculated",
        blockedMetrics: [],
      },
      fees: {
        amount: null,
        currency: null,
        valueClassification: "none",
        blockedMetrics: [],
      },
      taxes: {
        amount: null,
        currency: null,
        valueClassification: "none",
        blockedMetrics: [],
      },
      warnings: [],
      blockedMetrics: [],
      confidence: "medium",
      valueClassification: "preliminary",
      sourceType: "local_snapshot",
      sourceScope: "selected_portfolios",
      freshnessState: "fresh",
      scopeState: "scope_match",
      portfolioBreakdown: [
        {
          portfolioId: "synthetic-portfolio-alpha",
          portfolioName: "Synthetic Guarded Alpha Portfolio",
          status: "active",
          quantity: 888,
          marketValue: {
            amount: 888888,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          costBasis: {
            amount: 777777,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          unrealizedPnL: {
            amount: 111111,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          dividendsNet: {
            amount: 30,
            currency: "EUR",
            valueClassification: "app_calculated",
            blockedMetrics: [],
          },
          fees: {
            amount: null,
            currency: null,
            valueClassification: "none",
            blockedMetrics: [],
          },
          taxes: {
            amount: null,
            currency: null,
            valueClassification: "none",
            blockedMetrics: [],
          },
          warnings: [],
          blockedMetrics: [],
          confidence: "medium",
        },
      ],
      latestActivityAt: SYNTHETIC_LOADED_AT,
    },
  ],
  summary: {
    assetCount: 2,
    activeAssetCount: 2,
    closedAssetCount: 0,
    unknownAssetCount: 0,
    warningAssetCount: 0,
    blockerWarningCount: 0,
    blockedMetricAssetCount: 0,
    blockedMetricCount: 0,
    valueClassificationCounts: {
      provider_reference: 0,
      app_calculated: 0,
      estimated: 0,
      preliminary: 2,
      blocked: 0,
      none: 0,
    },
  },
};

const SYNTHETIC_STORAGE_STATE = {
  cookies: [],
  origins: ["http://127.0.0.1:3000", "http://localhost:3000"].map((origin) => ({
    origin,
    localStorage: [
      {
        name: KNOWN_PORTFOLIOS_STORAGE_KEY,
        value: JSON.stringify(SYNTHETIC_KNOWN_PORTFOLIOS),
      },
      {
        name: PORTFOLIO_SCOPE_STORAGE_KEY,
        value: JSON.stringify({
          mode: "manual",
          selectedPortfolioIds: ["synthetic-portfolio-alpha", "synthetic-portfolio-beta"],
        }),
      },
      {
        name: DASHBOARD_CACHE_KEY,
        value: JSON.stringify(SYNTHETIC_DASHBOARD_CACHE),
      },
    ],
  })),
};

const SYNTHETIC_STORAGE_STATE_WITH_GUARDED_PRODUCT = {
  cookies: [],
  origins: ["http://127.0.0.1:3000", "http://localhost:3000"].map((origin) => ({
    origin,
    localStorage: [
      {
        name: KNOWN_PORTFOLIOS_STORAGE_KEY,
        value: JSON.stringify(SYNTHETIC_KNOWN_PORTFOLIOS),
      },
      {
        name: PORTFOLIO_SCOPE_STORAGE_KEY,
        value: JSON.stringify({
          mode: "manual",
          selectedPortfolioIds: ["synthetic-portfolio-alpha", "synthetic-portfolio-beta"],
        }),
      },
      {
        name: DASHBOARD_CACHE_KEY,
        value: JSON.stringify({
          ...SYNTHETIC_DASHBOARD_CACHE,
          globalAssetProductReadModel: SYNTHETIC_GUARDED_PRODUCT_READ_MODEL,
        }),
      },
    ],
  })),
};

async function expectNoRouteFailures(
  page: Page,
  monitor: FailureMonitor,
  providerMonitor: ProviderRouteMonitor,
): Promise<void> {
  await page.waitForTimeout(100);
  providerMonitor.assertNoUnexpectedRequests();
  monitor.assertNoFailures();
}

test.describe("V1 local smoke routes", () => {
  for (const route of LOCAL_SMOKE_ROUTES) {
    test(`renders ${route} without hydration or page errors`, async ({
      page,
    }) => {
      const monitor = createFailureMonitor(page);

      await visitSmokeRoute(page, route);

      monitor.assertNoFailures();
    });
  }
});

test("local-only navigation does not call expensive Parqet provider routes", async ({
  page,
}) => {
  const monitor = createFailureMonitor(page);
  const providerMonitor = createProviderRouteMonitor(page);

  for (const route of API_BUDGET_ROUTES) {
    await visitSmokeRoute(page, route);
  }

  providerMonitor.assertNoUnexpectedRequests();
  monitor.assertNoFailures();
});

test.describe("V1 synthetic local interaction smoke tests", () => {
  test.use({ storageState: SYNTHETIC_STORAGE_STATE });

  test("activities uses synthetic local state for filter, search, pagination and details", async ({
    page,
  }) => {
    const monitor = createFailureMonitor(page);
    const providerMonitor = createProviderRouteMonitor(page);

    await visitSmokeRoute(page, "/activities");

    await expect(page.getByText("Geladener Snapshot")).toBeVisible();
    await expect(page.getByText("36 von 36")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Kauf Synthetic Smoke Asset 5 öffnen/ }),
    ).toBeVisible();
    await expect(page.getByText("Synthetic Search Needle Fund").first()).toBeVisible();

    await page.getByRole("button", { name: "Filter anzeigen" }).click();
    await expect(page.getByRole("button", { name: "Filter einklappen" })).toBeVisible();
    await page.getByRole("button", { name: "Filter einklappen" }).click();
    await expect(page.getByRole("button", { name: "Filter anzeigen" })).toBeVisible();

    await page.getByRole("button", { name: "Filter anzeigen" }).click();
    await page.getByLabel("Suche").fill("Needle");
    await expect(page.getByText("Synthetic Search Needle Fund")).toBeVisible();
    await expect(page.getByText("1 von 36")).toBeVisible();

    await page.getByRole("button", { name: "Zurücksetzen" }).click();
    await expect(page.getByText("36 von 36")).toBeVisible();

    await page.getByRole("checkbox", { name: "Kauf", exact: true }).uncheck();
    await expect(page.getByText("29 von 36")).toBeVisible();

    await page.getByRole("button", { name: "Zurücksetzen" }).click();
    await page.getByRole("button", { name: /Mehr lokal anzeigen/ }).click();
    await expect(page.getByRole("button", { name: /Mehr lokal anzeigen/ })).toHaveCount(0);

    await page.getByRole("button", { name: /Kauf Synthetic Smoke Asset 5 öffnen/ }).click();
    await expect(page.getByRole("complementary", { name: "Aktivitätsdetails" })).toBeVisible();
    await page.getByRole("button", { name: "Schließen" }).click();
    await expect(page.getByRole("heading", { name: "Aktivität auswählen" })).toBeVisible();

    await expectNoRouteFailures(page, monitor, providerMonitor);
  });

  test("timeline uses synthetic local state for filter, search, date and type interactions", async ({
    page,
  }) => {
    const monitor = createFailureMonitor(page);
    const providerMonitor = createProviderRouteMonitor(page);

    await visitSmokeRoute(page, "/timeline");

    await expect(page.getByText("Geladener Snapshot")).toBeVisible();
    await expect(page.getByText("36 Ereignisse").first()).toBeVisible();
    await expect(page.getByText("Synthetic Search Needle Fund").first()).toBeVisible();
    await expect(page.getByText(/Synthetic Monat 0[1-4]/).first()).toBeVisible();

    await page.getByRole("button", { name: "Filter anzeigen" }).click();
    await expect(page.getByRole("button", { name: "Filter einklappen" })).toBeVisible();
    await page.getByRole("button", { name: "Filter einklappen" }).click();
    await expect(page.getByRole("button", { name: "Filter anzeigen" })).toBeVisible();

    await page.getByRole("button", { name: "Filter anzeigen" }).click();
    await page.getByLabel("Suche").fill("Needle");
    await expect(page.getByText("Synthetic Search Needle Fund")).toBeVisible();
    await expect(page.getByText("1 Ereignisse", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Zurücksetzen" }).click();
    await page.getByLabel("Von").fill("2026-04-01");
    await expect(page.getByText("9 Ereignisse", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Zurücksetzen" }).click();
    await page.getByRole("checkbox", { name: "Kauf", exact: true }).uncheck();
    await expect(page.getByText("29 Ereignisse").first()).toBeVisible();

    await expectNoRouteFailures(page, monitor, providerMonitor);
  });

  test("settings displays synthetic local scope and keeps local-only interactions provider-call safe", async ({
    page,
  }) => {
    const monitor = createFailureMonitor(page);
    const providerMonitor = createProviderRouteMonitor(page);

    await visitSmokeRoute(page, "/settings");

    await expect(page.getByText("Synthetic Alpha Portfolio")).toBeVisible();
    await expect(page.getByText("Synthetic Beta Portfolio")).toBeVisible();
    await expect(page.getByText("Autorisiert: 2 Portfolios.")).toBeVisible();
    await expect(page.getByText("36 lokale", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Hell" }).click();
    await expect(page.getByText("Aktiv: Hell.")).toBeVisible();
    await page.getByRole("button", { name: "Manuelle Auswahl" }).click();
    await expect(
      page.getByText("Portfolio-Scope lokal gespeichert. Es wurden keine Parqet-Daten geladen."),
    ).toBeVisible();

    await expectNoRouteFailures(page, monitor, providerMonitor);
  });

  test("reports renders synthetic dashboard report state without provider calls", async ({
    page,
  }) => {
    const monitor = createFailureMonitor(page);
    const providerMonitor = createProviderRouteMonitor(page);

    await visitSmokeRoute(page, "/reports");

    await expect(page.getByRole("heading", { name: "Lokaler Portfolio-Report" })).toBeVisible();
    await expect(page.getByText("Synthetic Report Asset One")).toBeVisible();
    await expect(page.getByText("Synthetic Alpha Portfolio, Synthetic Beta Portfolio").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Markdown kopieren" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "CSV exportieren" })).toBeEnabled();

    await expectNoRouteFailures(page, monitor, providerMonitor);
  });
});

test.describe("V1 guarded global asset safe-default smoke", () => {
  test.use({ storageState: SYNTHETIC_STORAGE_STATE_WITH_GUARDED_PRODUCT });

  test("dashboard and reports use guarded identity fields while valuation remains compatibility-backed", async ({
    page,
  }) => {
    const monitor = createFailureMonitor(page);
    const providerMonitor = createProviderRouteMonitor(page);

    await visitSmokeRoute(page, "/dashboard");
    await expect(page.getByText("Synthetic Guarded Product One")).toBeVisible();
    await expect(page.getByText("Synthetic Guarded Product Two")).toBeVisible();
    await expect(page.getByText("4.248,00", { exact: false })).toBeVisible();

    await page.goto("/reports", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Synthetic Guarded Product One")).toBeVisible();
    await expect(
      page.getByText("Synthetic Guarded Alpha Portfolio, Synthetic Guarded Beta Portfolio"),
    ).toBeVisible();
    await expect(page.getByText("4.248,00", { exact: false })).toBeVisible();
    await expect(page.getByText("168,00", { exact: false })).toBeVisible();

    await expectNoRouteFailures(page, monitor, providerMonitor);
  });
});
