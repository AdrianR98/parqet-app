import { expect, test, type Page, type Request } from "@playwright/test";

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

function isUnexpectedProviderRoute(request: Request): boolean {
  const url = new URL(request.url());

  return (
    url.pathname === "/api/parqet/assets" ||
    url.pathname === "/api/parqet/activities"
  );
}

test.describe("V1 local smoke routes", () => {
  for (const route of LOCAL_SMOKE_ROUTES) {
    test(`renders ${route} without hydration or page errors`, async ({
      page,
    }) => {
      const monitor = createFailureMonitor(page);

      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();

      monitor.assertNoFailures();
    });
  }
});

test("local-only navigation does not call expensive Parqet provider routes", async ({
  page,
}) => {
  const monitor = createFailureMonitor(page);
  const unexpectedRequests: string[] = [];

  page.on("request", (request) => {
    if (isUnexpectedProviderRoute(request)) {
      unexpectedRequests.push(request.url());
    }
  });

  for (const route of API_BUDGET_ROUTES) {
    await page.goto(route);
    await expect(page.locator("body")).toBeVisible();
  }

  expect(unexpectedRequests).toEqual([]);
  monitor.assertNoFailures();
});
