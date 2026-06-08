import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeCurrency(value) {
    const normalized = String(value ?? "").trim().toUpperCase();
    return normalized || null;
}

function parsePositiveInt(raw, flagName) {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid ${flagName} value: ${raw}`);
    }
    return parsed;
}

function parseListArg(targetSet, rawValue) {
    if (!rawValue) return;
    for (const part of String(rawValue).split(",")) {
        const normalized = normalizeIsin(part);
        if (normalized) targetSet.add(normalized);
    }
}

function parseArgs(argv) {
    const options = {
        validate: false,
        write: false,
        continueOnError: false,
        help: false,
        limit: null,
        isin: null,
        excludeIsins: new Set(),
        python: "python",
    };

    const passthrough = [];
    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--help") {
            options.help = true;
            continue;
        }
        if (token === "--validate") {
            options.validate = true;
            passthrough.push(token);
            continue;
        }
        if (token === "--write") {
            options.write = true;
            passthrough.push(token);
            continue;
        }
        if (token === "--continue-on-error") {
            options.continueOnError = true;
            passthrough.push(token);
            continue;
        }
        if (token === "--limit") {
            const value = args.shift();
            options.limit = parsePositiveInt(value, "--limit");
            passthrough.push(token, value);
            continue;
        }
        if (token === "--isin") {
            const value = args.shift();
            options.isin = normalizeIsin(value);
            passthrough.push(token, value);
            continue;
        }
        if (token === "--exclude-isin") {
            const value = args.shift();
            parseListArg(options.excludeIsins, value);
            passthrough.push(token, value);
            continue;
        }
        if (token === "--python") {
            const value = String(args.shift() ?? "python").trim() || "python";
            options.python = value;
            passthrough.push(token, value);
            continue;
        }

        throw new Error(`Unknown argument: ${token}`);
    }

    options.passthrough = passthrough;
    return options;
}

function getWriteModeGuardError(options) {
    if (options.write && !options.validate) {
        return "db:market:resolve-primary refuses --write without --validate.";
    }
    return null;
}

function printHelp() {
    console.log("db:market:resolve-primary");
    console.log("- default: DB-only dry-run for current primary mappings and verified/proposed EUR alternatives");
    console.log("- --validate: explicit provider validation for proposed EUR alternatives");
    console.log("- --write: requires --validate; stores verified EUR candidates if needed and switches only safe primary mappings");
    console.log("- no price deletion, no history replacement, no price rebuild");
}

function safeMessage(error) {
    if (error instanceof Error && error.message) return error.message;
    return String(error);
}

function formatCandidate(candidate) {
    if (!candidate) return "-";
    return `${candidate.symbol} | tier=${candidate.tier} | exchange=${candidate.exchange ?? "-"} | currency=${candidate.currency ?? "-"} | source=${candidate.sourceType}`;
}

function formatCandidateList(candidates, limit = 3) {
    if (!candidates || candidates.length === 0) return "-";
    return candidates.slice(0, limit).map((candidate) => candidate.symbol).join(", ");
}

function printPlan(plan) {
    console.log("Resolve EUR Primary Report");
    console.log("- mode: dry-run");
    console.log("- provider calls: disabled");
    console.log(`- total primary mappings inspected: ${plan.totalPrimaryMappingsInspected}`);
    console.log(`- current EUR primaries: ${plan.currentEurPrimaries}`);
    console.log(`- current non-EUR primaries: ${plan.currentNonEurPrimaries}`);
    console.log(`- auto-resolvable EUR candidates: ${plan.autoResolvableCandidates}`);
    console.log(`- .DE candidates: ${plan.deCandidates}`);
    console.log(`- German EUR fallback candidates: ${plan.germanEurFallbackCandidates}`);
    console.log(`- other EUR fallback candidates: ${plan.otherEurFallbackCandidates}`);
    console.log(`- manual_review / blocked cases: ${plan.manualReviewCases}`);
    console.log(`- terminal ignored cases: ${plan.terminalIgnoredCases}`);

    const autoRows = plan.items.filter((item) => item.status === "auto_resolvable");
    if (autoRows.length > 0) {
        console.log("Auto-resolvable candidates:");
        for (const item of autoRows) {
            console.log(`- ${item.isin} | ${item.displayName ?? "-"} | primary=${item.currentPrimarySymbol} ${item.currentPrimaryCurrency ?? "-"} -> candidate=${formatCandidate(item.selectedCandidate)}`);
        }
    }

    const manualRows = plan.items.filter((item) => item.status === "manual_review");
    if (manualRows.length > 0) {
        console.log("Manual-review / blocked candidates:");
        for (const item of manualRows) {
            const ownerSuffix = item.selectedCandidate?.ownerIsin ? ` | owner_isin=${item.selectedCandidate.ownerIsin}` : "";
            console.log(`- ${item.isin} | ${item.displayName ?? "-"} | primary=${item.currentPrimarySymbol} ${item.currentPrimaryCurrency ?? "-"} | reason=${item.reason} | verified=${formatCandidateList(item.verifiedCandidates)} | proposed=${formatCandidateList(item.proposalCandidates)}${ownerSuffix}`);
        }
    }
}

function createValidationSummaryItem({ item, status, reason, selectedCandidate, validatedCandidates }) {
    return {
        assetId: item.assetId,
        isin: item.isin,
        displayName: item.displayName,
        marketDataStatus: item.marketDataStatus,
        currentPrimarySymbol: item.currentPrimarySymbol,
        currentPrimaryCurrency: item.currentPrimaryCurrency,
        status,
        reason,
        selectedCandidate,
        validatedCandidates,
    };
}

async function validateProposalCandidates({ python, proposalRows }) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "parqet-resolve-eur-primary-"));
    const inputPath = path.join(tempDir, "candidates.json");
    const outPath = path.join(tempDir, "validation.json");

    try {
        await writeFile(inputPath, JSON.stringify(proposalRows, null, 2), "utf8");
        await runCommand(
            python,
            [
                "scripts/yfinance/validate-symbol-candidates.py",
                "--input",
                inputPath,
                "--out",
                outPath,
            ],
            "validate yfinance EUR candidates",
        );
        return JSON.parse(await readFile(outPath, "utf8"));
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}

function runCommand(command, args, label) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: process.cwd(),
            stdio: ["ignore", "pipe", "pipe"],
            env: process.env,
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += String(chunk);
        });
        child.stderr.on("data", (chunk) => {
            stderr += String(chunk);
        });

        child.on("error", (error) => {
            reject(new Error(`${label} failed to start: ${safeMessage(error)}`));
        });
        child.on("close", (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }
            reject(new Error(`${label} failed (exit ${code})${stderr ? `: ${stderr.trim()}` : ""}`));
        });
    });
}

function chooseCandidateByTier(candidates) {
    if (!candidates || candidates.length === 0) {
        return {
            status: "no_candidate",
            reason: "no_candidate",
            selectedCandidate: null,
            validatedCandidates: [],
        };
    }

    const priority = { de: 0, german_eur_fallback: 1, other_eur_fallback: 2 };
    const sorted = [...candidates].sort((left, right) => {
        const tierDiff = priority[left.tier] - priority[right.tier];
        if (tierDiff !== 0) return tierDiff;
        return left.symbol.localeCompare(right.symbol);
    });
    const topTier = sorted[0].tier;
    const topTierRows = sorted.filter((candidate) => candidate.tier === topTier);
    const topTierUnconflicted = topTierRows.filter((candidate) => !candidate.hasOwnershipConflict);

    if (topTierUnconflicted.length === 1) {
        return {
            status: topTier === "de"
                ? "verified_de"
                : (topTier === "german_eur_fallback" ? "verified_german_eur_fallback" : "verified_other_eur_fallback"),
            reason: "validated_verified_candidate",
            selectedCandidate: topTierUnconflicted[0],
            validatedCandidates: sorted,
        };
    }

    if (topTierRows.length > 0 && topTierUnconflicted.length === 0) {
        return {
            status: "conflict",
            reason: "symbol_owned_by_other_asset",
            selectedCandidate: topTierRows[0],
            validatedCandidates: sorted,
        };
    }

    return {
        status: "ambiguous",
        reason: "ambiguous_verified_candidates",
        selectedCandidate: null,
        validatedCandidates: sorted,
    };
}

function buildValidationReport({ plan, validationResultsByKey }) {
    const items = [];

    for (const item of plan.items) {
        if (item.status === "already_eur_primary") {
            continue;
        }
        if (item.status === "terminal_ignored") {
            items.push(createValidationSummaryItem({
                item,
                status: "terminal_ignored",
                reason: "terminal_status",
                selectedCandidate: null,
                validatedCandidates: [],
            }));
            continue;
        }
        if (item.status === "auto_resolvable") {
            const selected = item.selectedCandidate;
            items.push(createValidationSummaryItem({
                item,
                status: selected.tier === "de"
                    ? "verified_de"
                    : (selected.tier === "german_eur_fallback" ? "verified_german_eur_fallback" : "verified_other_eur_fallback"),
                reason: "verified_candidate_available",
                selectedCandidate: selected,
                validatedCandidates: item.verifiedCandidates,
            }));
            continue;
        }
        if (item.reason === "symbol_owned_by_other_asset") {
            items.push(createValidationSummaryItem({
                item,
                status: "conflict",
                reason: "symbol_owned_by_other_asset",
                selectedCandidate: item.selectedCandidate,
                validatedCandidates: item.verifiedCandidates,
            }));
            continue;
        }

        const validatedVerifiedCandidates = [];
        let sawAmbiguous = false;
        let sawRejected = false;

        for (const proposal of item.proposalCandidates) {
            const validation = validationResultsByKey.get(`${item.isin}|${proposal.symbol}`);
            if (!validation) continue;
            if (validation.status === "verified") {
                validatedVerifiedCandidates.push(proposal);
                continue;
            }
            if (validation.status === "ambiguous") {
                sawAmbiguous = true;
                continue;
            }
            if (validation.status === "rejected") {
                sawRejected = true;
            }
        }

        if (validatedVerifiedCandidates.length > 0) {
            const selected = chooseCandidateByTier(validatedVerifiedCandidates);
            items.push(createValidationSummaryItem({
                item,
                status: selected.status,
                reason: selected.reason,
                selectedCandidate: selected.selectedCandidate,
                validatedCandidates: selected.validatedCandidates,
            }));
            continue;
        }

        if (sawAmbiguous) {
            items.push(createValidationSummaryItem({
                item,
                status: "ambiguous",
                reason: "ambiguous",
                selectedCandidate: null,
                validatedCandidates: [],
            }));
            continue;
        }

        if (sawRejected) {
            items.push(createValidationSummaryItem({
                item,
                status: "rejected",
                reason: "rejected",
                selectedCandidate: null,
                validatedCandidates: [],
            }));
            continue;
        }

        items.push(createValidationSummaryItem({
            item,
            status: "no_candidate",
            reason: item.proposalCandidates.length > 0 ? "no_validated_candidate" : "no_candidate",
            selectedCandidate: null,
            validatedCandidates: [],
        }));
    }

    return items;
}

function printValidationReport(report) {
    const counts = new Map();
    for (const item of report) {
        counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    }

    console.log("Resolve EUR Primary Validation Report");
    console.log("- mode: validate");
    console.log("- provider calls: enabled via explicit --validate");
    for (const status of [
        "verified_de",
        "verified_german_eur_fallback",
        "verified_other_eur_fallback",
        "conflict",
        "ambiguous",
        "rejected",
        "no_candidate",
        "terminal_ignored",
    ]) {
        console.log(`- ${status}: ${counts.get(status) ?? 0}`);
    }

    for (const item of report) {
        if (item.status === "terminal_ignored") continue;
        console.log(`- ${item.isin} | ${item.displayName ?? "-"} | primary=${item.currentPrimarySymbol} ${item.currentPrimaryCurrency ?? "-"} | status=${item.status} | reason=${item.reason} | candidate=${formatCandidate(item.selectedCandidate)}`);
    }
}

function printWriteSummary(summary) {
    console.log("Resolve EUR Primary Write Summary");
    console.log(`- selected write candidates: ${summary.selected}`);
    console.log(`- successful primary switches: ${summary.succeeded}`);
    console.log(`- failed primary switches: ${summary.failed}`);
}

function needsVerifiedPrimaryPromotion(candidate) {
    return Boolean(candidate) && candidate.verified !== true;
}

async function executeWriteMode({ report, options }) {
    const {
        setPrimarySymbolMappingById,
        storeVerifiedSymbolMappingCandidate,
    } = await import("../src/lib/market-data/db/repository-core.ts");

    const selected = report
        .filter((item) => item.status === "verified_de" || item.status === "verified_german_eur_fallback" || item.status === "verified_other_eur_fallback")
        .filter((item) => item.selectedCandidate);
    const limitedSelected = options.limit ? selected.slice(0, options.limit) : selected;

    const summary = {
        selected: limitedSelected.length,
        succeeded: 0,
        failed: 0,
    };

    for (const item of limitedSelected) {
        try {
            let targetMappingId = item.selectedCandidate.mappingId ?? null;
            if (needsVerifiedPrimaryPromotion(item.selectedCandidate)) {
                const stored = await storeVerifiedSymbolMappingCandidate({
                    instrumentId: item.assetId,
                    provider: "yfinance",
                    symbol: item.selectedCandidate.symbol,
                    exchange: item.selectedCandidate.exchange ?? null,
                    currency: normalizeCurrency(item.selectedCandidate.currency),
                    notes: `resolve_primary_eur; status=${item.status}; source=${item.selectedCandidate.sourceType}`,
                });
                if (stored.status !== "written_verified" && stored.status !== "already_verified") {
                    throw new Error(stored.reason);
                }
                targetMappingId = stored.mappingId ?? null;
            }
            if (!targetMappingId) {
                throw new Error("verified_mapping_id_missing");
            }

            await setPrimarySymbolMappingById(
                targetMappingId,
                "yfinance",
                item.isin,
                `resolve_primary_eur; old_primary=${item.currentPrimarySymbol}; resolution=${item.status}`,
            );
            summary.succeeded += 1;
        } catch (error) {
            summary.failed += 1;
            console.log(`- ${item.isin} | ${item.displayName ?? "-"} | status=failed | reason=${safeMessage(error)}`);
            if (!options.continueOnError) {
                throw error;
            }
        }
    }

    return summary;
}

async function closeDbPool() {
    try {
        const { endPostgresPool } = await import("../src/lib/db/postgres-core.ts");
        await endPostgresPool();
    } catch {}
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const guardError = getWriteModeGuardError(options);
    if (guardError) {
        throw new Error(guardError);
    }

    const {
        listMarketInstruments,
        listReferenceInstrumentsByIsin,
        listSymbolMappingsForPrimaryPreference,
    } = await import("../src/lib/market-data/db/repository-core.ts");
    const {
        buildEurPrimaryResolutionPlan,
    } = await import("../src/lib/market-data/resolve-eur-primary.ts");
    const {
        classifyDeCandidateValidation,
    } = await import("../src/lib/market-data/discover-de-candidates.ts");

    const instruments = await listMarketInstruments({ limit: 50000 });
    const filteredInstruments = instruments.filter((instrument) => {
        const isin = normalizeIsin(instrument.isin);
        if (options.isin && isin !== options.isin) return false;
        if (options.excludeIsins.has(isin)) return false;
        return true;
    });
    const mappings = await listSymbolMappingsForPrimaryPreference("yfinance", options.isin ?? undefined);
    const filteredMappings = mappings.filter((mapping) => !options.excludeIsins.has(normalizeIsin(mapping.isin)));

    const referenceCandidatesByIsin = new Map();
    const primaryByIsin = new Map();
    for (const mapping of filteredMappings) {
        if (mapping.isPrimary) {
            primaryByIsin.set(mapping.isin, mapping);
        }
    }

    for (const instrument of filteredInstruments) {
        const primary = primaryByIsin.get(instrument.isin);
        if (!primary || normalizeCurrency(primary.currency) === "EUR") {
            continue;
        }
        referenceCandidatesByIsin.set(
            instrument.isin,
            await listReferenceInstrumentsByIsin(instrument.isin),
        );
    }

    const plan = buildEurPrimaryResolutionPlan({
        instruments: filteredInstruments,
        mappings: filteredMappings,
        referenceCandidatesByIsin,
    });

    if (!options.validate) {
        printPlan(plan);
        return;
    }

    const proposalRows = [];
    for (const item of plan.items) {
        if (item.status !== "manual_review") continue;
        for (const proposal of item.proposalCandidates) {
            proposalRows.push({
                isin: item.isin,
                symbol: proposal.symbol,
                displayName: item.displayName,
                exchange: proposal.exchange,
                currency: proposal.currency,
                tier: proposal.tier,
                sourceType: proposal.sourceType,
            });
        }
    }

    const validationPayload = proposalRows.length > 0
        ? await validateProposalCandidates({ python: options.python, proposalRows })
        : [];
    const validationResultsByKey = new Map();
    for (const row of validationPayload) {
        const decision = classifyDeCandidateValidation({
            isin: row.isin ?? null,
            symbol: row.symbol,
            hasHistory: Boolean(row.hasHistory),
            pointCount: Number(row.pointCount ?? 0),
            lastDate: row.lastDate ?? null,
            latestClose: row.latestClose ?? null,
            currency: row.currency ?? null,
            error: row.error ?? null,
        });
        validationResultsByKey.set(`${normalizeIsin(row.isin)}|${String(row.symbol).toUpperCase()}`, decision);
    }

    const report = buildValidationReport({ plan, validationResultsByKey });
    printValidationReport(report);

    if (!options.write) {
        return;
    }

    const summary = await executeWriteMode({ report, options });
    printWriteSummary(summary);
}

export {
    getWriteModeGuardError,
    needsVerifiedPrimaryPromotion,
    parseArgs,
};

const isDirectExecution = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isDirectExecution) {
    run()
        .catch((error) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
        })
        .finally(async () => {
            await closeDbPool();
        });
}
