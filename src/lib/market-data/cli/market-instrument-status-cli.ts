import type { DbMarketInstrument, MarketDataInstrumentStatus } from "../db/types-core";

export const VALID_MARKET_STATUSES: MarketDataInstrumentStatus[] = ["active", "excluded", "legacy", "derivative", "unknown"];
const VALID_STATUS_SET = new Set<MarketDataInstrumentStatus>(VALID_MARKET_STATUSES);

export const STATUS_HELP_TEXT = `Set market instrument status (safe by default).

Usage:
  npm run db:market:set:instrument-status -- --isin <ISIN> --status <status> [flags]

Required:
  --isin <ISIN>
  --status <active|excluded|legacy|derivative|unknown>

Optional:
  --reason <text>
  --successor-isin <ISIN>
  --successor-symbol <symbol>
  --force
  --write
  --help
`;

export type StatusCliOptions = {
    isin: string | null;
    status: MarketDataInstrumentStatus | null;
    reason: string | null | undefined;
    successorIsin: string | null | undefined;
    successorSymbol: string | null | undefined;
    write: boolean;
    force: boolean;
    help: boolean;
};

export type StatusPlan = {
    next: {
        status: MarketDataInstrumentStatus;
        reason: string | null;
        successorIsin: string | null;
        successorSymbol: string | null;
    };
    changes: Array<{
        field:
            | "market_data_status"
            | "market_data_status_reason"
            | "market_data_successor_isin"
            | "market_data_successor_symbol";
        before: string | null;
        after: string | null;
    }>;
};

function normalizeIsin(value: string | null | undefined): string {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeText(value: string | null | undefined): string | null {
    if (value == null) return null;
    const normalized = String(value).trim();
    return normalized || null;
}

function normalizeSymbol(value: string | null | undefined): string | null {
    const normalized = normalizeText(value);
    return normalized ? normalized.toUpperCase() : null;
}

function asStatus(value: string | null | undefined): MarketDataInstrumentStatus | null {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return null;
    if (!VALID_STATUS_SET.has(normalized as MarketDataInstrumentStatus)) return null;
    return normalized as MarketDataInstrumentStatus;
}

export function parseStatusCliArgs(argv: string[]): StatusCliOptions {
    const options: StatusCliOptions = {
        isin: null,
        status: null,
        reason: undefined,
        successorIsin: undefined,
        successorSymbol: undefined,
        write: false,
        force: false,
        help: false,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--isin") {
            options.isin = normalizeIsin(args.shift());
            continue;
        }
        if (token === "--status") {
            const status = asStatus(args.shift());
            options.status = status;
            continue;
        }
        if (token === "--reason") {
            options.reason = normalizeText(args.shift());
            continue;
        }
        if (token === "--successor-isin") {
            const normalized = normalizeIsin(args.shift());
            options.successorIsin = normalized || null;
            continue;
        }
        if (token === "--successor-symbol") {
            options.successorSymbol = normalizeSymbol(args.shift());
            continue;
        }
        if (token === "--write") {
            options.write = true;
            continue;
        }
        if (token === "--force") {
            options.force = true;
            continue;
        }
        if (token === "--help") {
            options.help = true;
            continue;
        }

        throw new Error(`Unknown argument: ${token}`);
    }

    if (options.help) return options;

    if (!options.isin || !/^[A-Z0-9]{12}$/.test(options.isin)) {
        throw new Error("Missing or invalid required --isin.");
    }
    if (!options.status) {
        throw new Error("Missing or invalid required --status.");
    }
    if (options.successorIsin && !/^[A-Z0-9]{12}$/.test(options.successorIsin)) {
        throw new Error("Invalid --successor-isin.");
    }

    return options;
}

export function buildStatusUpdatePlan(before: DbMarketInstrument, options: StatusCliOptions): StatusPlan {
    if (!options.status) {
        throw new Error("Missing status in planning input.");
    }

    const nextStatus = options.status;

    const nextReason =
        options.reason !== undefined
            ? options.reason
            : before.marketDataStatusReason;

    const nextSuccessorIsin = nextStatus === "active"
        ? null
        : options.successorIsin !== undefined
            ? options.successorIsin
            : before.marketDataSuccessorIsin;

    const nextSuccessorSymbol = nextStatus === "active"
        ? null
        : options.successorSymbol !== undefined
            ? options.successorSymbol
            : before.marketDataSuccessorSymbol;

    const changes: StatusPlan["changes"] = [];
    const currentStatus = before.marketDataStatus;
    const currentReason = before.marketDataStatusReason;
    const currentSuccessorIsin = before.marketDataSuccessorIsin;
    const currentSuccessorSymbol = before.marketDataSuccessorSymbol;

    if (currentStatus !== nextStatus) {
        changes.push({ field: "market_data_status", before: currentStatus, after: nextStatus });
    }
    if (currentReason !== nextReason) {
        changes.push({ field: "market_data_status_reason", before: currentReason, after: nextReason });
    }
    if (currentSuccessorIsin !== nextSuccessorIsin) {
        changes.push({ field: "market_data_successor_isin", before: currentSuccessorIsin, after: nextSuccessorIsin });
    }
    if (currentSuccessorSymbol !== nextSuccessorSymbol) {
        changes.push({ field: "market_data_successor_symbol", before: currentSuccessorSymbol, after: nextSuccessorSymbol });
    }

    return {
        next: {
            status: nextStatus,
            reason: nextReason,
            successorIsin: nextSuccessorIsin,
            successorSymbol: nextSuccessorSymbol,
        },
        changes,
    };
}
