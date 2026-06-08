import { describe, expect, it } from "vitest";

import { parseArgs as parseRebuildArgs } from "../../scripts/market-data-rebuild-prices.mjs";
import { parseArgs as parseResolveArgs } from "../../scripts/market-data-resolve-primary.mjs";

describe("market data operator commands", () => {
    it("parses resolve-primary validate mode", () => {
        const options = parseResolveArgs(["--validate", "--write", "--isin", "GB00BP6MXD84"]);

        expect(options).toMatchObject({
            validate: true,
            write: true,
            help: false,
        });
        expect(options.passthrough).toEqual(["--validate", "--write", "--isin", "GB00BP6MXD84"]);
    });

    it("parses rebuild-prices reset guard flags", () => {
        const options = parseRebuildArgs(["--write", "--reset-yfinance-prices", "--compact", "--continue-on-error"]);

        expect(options).toMatchObject({
            write: true,
            resetYfinancePrices: true,
            compact: true,
            continueOnError: true,
        });
        expect(options.passthrough).toEqual(["--write", "--compact", "--continue-on-error"]);
    });

    it("parses rebuild-prices filters for delegated dry-run", () => {
        const options = parseRebuildArgs(["--isin", "GB00BP6MXD84", "--exclude-isin", "US00206R1023", "--limit", "5"]);

        expect(options.isin).toBe("GB00BP6MXD84");
        expect(options.excludeIsins.has("US00206R1023")).toBe(true);
        expect(options.limit).toBe("5");
        expect(options.write).toBe(false);
    });
});
