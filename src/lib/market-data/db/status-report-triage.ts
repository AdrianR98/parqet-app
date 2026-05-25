import type { MarketDataInstrumentStatus } from "./types-core";

const TERMINAL_STATUSES = new Set<MarketDataInstrumentStatus>(["excluded", "legacy", "derivative"]);
type TerminalStatus = "excluded" | "legacy" | "derivative";

export type StatusReportInstrumentRow = {
    isin: string;
    name: string | null;
    marketDataStatus: MarketDataInstrumentStatus | null;
};

export type StatusReportTriageSummary = {
    rawWithoutVerifiedMapping: StatusReportInstrumentRow[];
    actionableWithoutVerifiedMapping: StatusReportInstrumentRow[];
    terminalWithoutVerifiedMapping: StatusReportInstrumentRow[];
    manualReviewWithoutVerifiedMapping: StatusReportInstrumentRow[];
    terminalBreakdown: Record<TerminalStatus, number>;
};

function isTerminalStatus(status: MarketDataInstrumentStatus | null): status is TerminalStatus {
    return status !== null && TERMINAL_STATUSES.has(status);
}

export function buildStatusReportTriageSummary(input: {
    instruments: StatusReportInstrumentRow[];
    verifiedIsins: Set<string>;
}): StatusReportTriageSummary {
    const rawWithoutVerifiedMapping = input.instruments.filter((item) => !input.verifiedIsins.has(item.isin));
    const actionableWithoutVerifiedMapping: StatusReportInstrumentRow[] = [];
    const terminalWithoutVerifiedMapping: StatusReportInstrumentRow[] = [];
    const manualReviewWithoutVerifiedMapping: StatusReportInstrumentRow[] = [];
    const terminalBreakdown: StatusReportTriageSummary["terminalBreakdown"] = {
        excluded: 0,
        legacy: 0,
        derivative: 0,
    };

    for (const row of rawWithoutVerifiedMapping) {
        if (row.marketDataStatus === "unknown") {
            manualReviewWithoutVerifiedMapping.push(row);
            continue;
        }

        if (isTerminalStatus(row.marketDataStatus)) {
            terminalWithoutVerifiedMapping.push(row);
            terminalBreakdown[row.marketDataStatus] += 1;
            continue;
        }

        actionableWithoutVerifiedMapping.push(row);
    }

    return {
        rawWithoutVerifiedMapping,
        actionableWithoutVerifiedMapping,
        terminalWithoutVerifiedMapping,
        manualReviewWithoutVerifiedMapping,
        terminalBreakdown,
    };
}
