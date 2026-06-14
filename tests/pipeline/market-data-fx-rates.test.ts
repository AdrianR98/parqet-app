import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { queryMock, withClientMock } = vi.hoisted(() => ({
    queryMock: vi.fn(),
    withClientMock: vi.fn(),
}));

vi.mock("../../src/lib/db/postgres-core", () => ({
    PostgresConfigError: class PostgresConfigError extends Error {},
    queryPostgres: queryMock,
    withPostgresClient: withClientMock,
}));

import { getUsdEurFxRatesByDates } from "../../src/lib/market-data/fx-rates";

describe("USD/EUR FX rate repository", () => {
    beforeEach(() => {
        queryMock.mockReset();
        withClientMock.mockReset();
    });

    it("returns one USD/EUR daily rate per requested date", async () => {
        queryMock.mockResolvedValue({
            rows: [
                {
                    provider: "ecb",
                    base_currency: "USD",
                    quote_currency: "EUR",
                    rate_date: "2026-06-03",
                    rate: "0.92",
                    source: "manual_fixture",
                    updated_at: "2026-06-04T00:00:00.000Z",
                },
            ],
        });

        const result = await getUsdEurFxRatesByDates({
            dates: ["2026-06-03", "2026-06-03"],
        });

        expect(result["2026-06-03"]).toEqual({
            fromCurrency: "USD",
            toCurrency: "EUR",
            rate: 0.92,
            rateDate: "2026-06-03",
            provider: "ecb",
            source: "manual_fixture",
        });
        expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("fx_daily_rates"), [["2026-06-03"], null]);
    });

    it("does not query the database when no valid dates are requested", async () => {
        const result = await getUsdEurFxRatesByDates({ dates: ["bad"] });

        expect(result).toEqual({});
        expect(queryMock).not.toHaveBeenCalled();
    });
});
