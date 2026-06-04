import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function parsePositiveInt(raw, fallback, flagName) {
    if (raw == null || raw === "") return fallback;
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
        write: false,
        validate: false,
        limit: 100,
        isins: new Set(),
        excludeIsins: new Set(),
        python: "python",
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--write") {
            options.write = true;
            continue;
        }
        if (token === "--validate") {
            options.validate = true;
            continue;
        }
        if (token === "--limit") {
            options.limit = parsePositiveInt(args.shift(), 100, "--limit");
            continue;
        }
        if (token === "--isin") {
            parseListArg(options.isins, args.shift());
            continue;
        }
        if (token === "--exclude-isin") {
            parseListArg(options.excludeIsins, args.shift());
            continue;
        }
        if (token === "--python") {
            options.python = String(args.shift() ?? "python").trim() || "python";
            continue;
        }

        throw new Error(`Unknown argument: ${token}`);
    }

    return options;
}

function safeMessage(error) {
    if (error instanceof Error && error.message) return error.message;
    return "Unknown error";
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

function formatExistingMappings(mappings) {
    if (!mappings || mappings.length === 0) {
        return "-";
    }
    return mappings
        .map((mapping) => {
            const status = mapping.verifiedAt ? "verified" : "candidate";
            const primary = mapping.isPrimary ? "primary" : "secondary";
            return `${mapping.symbol} (${primary}, ${status}, ${mapping.exchange ?? "-"}, ${mapping.currency ?? "-"})`;
        })
        .join("; ");
}

function formatReferenceCandidates(candidates) {
    if (!candidates || candidates.length === 0) {
        return "-";
    }
    return candidates
        .slice(0, 6)
        .map((candidate) => {
            const renderedSymbol = candidate.symbol ?? (candidate.mnemonic ? `${candidate.mnemonic}.DE?` : "-");
            return `${candidate.sourceKey}:${renderedSymbol}:${candidate.exchange ?? "-"}:${candidate.currency ?? "-"}`;
        })
        .join("; ");
}

function formatProposals(proposals) {
    if (!proposals || proposals.length === 0) {
        return "-";
    }
    return proposals.map((proposal) => `${proposal.symbol} [${proposal.sourceKey}/${proposal.sourceType}]`).join("; ");
}

async function validateProposals({ python, proposals }) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "parqet-discover-de-"));
    const inputPath = path.join(tempDir, "candidates.json");
    const outPath = path.join(tempDir, "validation.json");

    try {
        await writeFile(
            inputPath,
            JSON.stringify(
                proposals.map((proposal) => ({
                    isin: proposal.isin,
                    symbol: proposal.symbol,
                    displayName: proposal.displayName,
                })),
                null,
                2,
            ),
            "utf8",
        );

        await runCommand(
            python,
            [
                "scripts/yfinance/validate-symbol-candidates.py",
                "--input",
                inputPath,
                "--out",
                outPath,
            ],
            "validate yfinance .DE candidates",
        );

        return JSON.parse(await readFile(outPath, "utf8"));
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}

async function closeDbPool() {
    try {
        const { endPostgresPool } = await import("../src/lib/db/postgres-core.ts");
        await endPostgresPool();
    } catch {}
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    const {
        getInstrumentByIsin,
        insertSymbolMappingCandidate,
        listMarketInstruments,
        listReferenceInstrumentsByIsin,
        listSymbolMappingsForPrimaryPreference,
        storeVerifiedSymbolMappingCandidate,
    } = await import("../src/lib/market-data/db/repository-core.ts");
    const {
        buildDeCandidateDiscoveryPlan,
        classifyDeCandidateValidation,
        decideDeCandidateWriteAction,
    } = await import("../src/lib/market-data/discover-de-candidates.ts");

    const allInstruments = await listMarketInstruments({ limit: 50000 });
    const filteredInstruments = allInstruments.filter((instrument) => {
        const isin = normalizeIsin(instrument.isin);
        if (options.isins.size > 0 && !options.isins.has(isin)) return false;
        if (options.excludeIsins.has(isin)) return false;
        return true;
    });

    const allMappings = await listSymbolMappingsForPrimaryPreference("yfinance");
    const mappingsByIsin = new Map();
    for (const mapping of allMappings) {
        const isin = normalizeIsin(mapping.isin);
        if (options.isins.size > 0 && !options.isins.has(isin)) continue;
        if (options.excludeIsins.has(isin)) continue;
        const list = mappingsByIsin.get(isin) ?? [];
        list.push(mapping);
        mappingsByIsin.set(isin, list);
    }

    const discoveryAssets = [];
    for (const instrument of filteredInstruments) {
        const existingYfinanceMappings = mappingsByIsin.get(instrument.isin) ?? [];
        const referenceCandidates = await listReferenceInstrumentsByIsin(instrument.isin);
        const currentPrimary = existingYfinanceMappings.find((mapping) => mapping.isPrimary) ?? null;

        discoveryAssets.push({
            assetId: instrument.id,
            isin: instrument.isin,
            wkn: instrument.wkn ?? null,
            displayName: instrument.displayName ?? instrument.name ?? null,
            marketDataStatus: instrument.marketDataStatus,
            currentPrimarySymbol: currentPrimary?.symbol ?? null,
            currentPrimaryExchange: currentPrimary?.exchange ?? null,
            currentPrimaryCurrency: currentPrimary?.currency ?? null,
            existingYfinanceMappings,
            referenceCandidates,
        });
    }

    const plan = buildDeCandidateDiscoveryPlan(discoveryAssets);
    const missingItems = plan.items
        .filter((item) => !item.hasVerifiedDe)
        .slice(0, options.limit);
    const proposalRows = missingItems.flatMap((item) =>
        item.proposals.map((proposal) => ({
            isin: item.isin,
            displayName: item.displayName,
            symbol: proposal.symbol,
            exchange: proposal.exchange,
            currency: proposal.currency,
            sourceKey: proposal.sourceKey,
            sourceType: proposal.sourceType,
        })),
    );

    console.log("Discover .DE YFinance Candidates Report");
    console.log(`- mode: ${options.write ? (options.validate ? "validate + write" : "write") : (options.validate ? "validate" : "dry-run")}`);
    console.log(`- provider calls: ${options.validate ? "enabled via explicit --validate" : "disabled"}`);
    console.log(`- total assets inspected: ${plan.totalAssetsInspected}`);
    console.log(`- assets already with verified .DE: ${plan.assetsAlreadyWithVerifiedDe}`);
    console.log(`- assets missing .DE: ${plan.assetsMissingDe}`);
    console.log(`- skipped terminal/excluded/legacy/derivative assets: ${plan.skippedNonActionable}`);
    console.log(`- actionable unknown inspected: ${plan.actionableUnknownInspected}`);
    console.log(`- candidate proposals from reference data: ${plan.candidateProposalsFromReferenceData}`);

    if (missingItems.length > 0) {
        console.log("Missing .DE candidate detail:");
        for (const item of missingItems) {
            console.log(`- ${item.isin} | ${item.wkn ?? "-"} | ${item.displayName ?? "-"} | primary=${item.currentPrimarySymbol ?? "-"} | primaryExchange=${item.currentPrimaryExchange ?? "-"} | primaryCurrency=${item.currentPrimaryCurrency ?? "-"}`);
            console.log(`  existingYfinanceMappings: ${formatExistingMappings(item.existingYfinanceMappings)}`);
            console.log(`  referenceCandidates: ${formatReferenceCandidates(item.referenceCandidates)}`);
            console.log(`  possibleDeCandidates: ${formatProposals(item.proposals)}`);
        }
    }

    let validatedSuccess = 0;
    let rejectedCandidates = 0;
    let ambiguousCandidates = 0;
    let writtenVerifiedCandidates = 0;
    const validationBySymbol = new Map();

    if (options.validate && proposalRows.length > 0) {
        const validationResults = await validateProposals({
            python: options.python,
            proposals: proposalRows,
        });

        for (const row of validationResults) {
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
            validationBySymbol.set(`${normalizeIsin(row.isin)}|${String(row.symbol).toUpperCase()}`, {
                raw: row,
                decision,
            });
            if (decision.status === "verified") validatedSuccess += 1;
            if (decision.status === "rejected") rejectedCandidates += 1;
            if (decision.status === "ambiguous") ambiguousCandidates += 1;
        }
    }

    if (options.write && proposalRows.length > 0) {
        for (const proposal of proposalRows) {
            const validation = validationBySymbol.get(`${proposal.isin}|${proposal.symbol}`);
            const writeDecision = decideDeCandidateWriteAction({
                write: options.write,
                validate: options.validate,
                validationDecision: validation?.decision ?? null,
            });
            const instrument = await getInstrumentByIsin(proposal.isin);
            if (!instrument) {
                continue;
            }

            if (writeDecision.action === "store_unverified") {
                await insertSymbolMappingCandidate({
                    instrumentId: instrument.id,
                    provider: "yfinance",
                    symbol: proposal.symbol,
                    exchange: proposal.exchange ?? null,
                    currency: proposal.currency ?? null,
                    notes: `source=discover_de_candidate; status=proposed; proposal_source=${proposal.sourceKey}; proposal_type=${proposal.sourceType}`,
                });
                continue;
            }

            if (writeDecision.action === "store_verified") {
                const stored = await storeVerifiedSymbolMappingCandidate({
                    instrumentId: instrument.id,
                    provider: "yfinance",
                    symbol: proposal.symbol,
                    exchange: proposal.exchange ?? null,
                    currency: proposal.currency ?? null,
                    notes: `validated:yfinance; status=verified; source=discover_de_candidate; validation_reason=${validation.decision.reason}; proposal_source=${proposal.sourceKey}`,
                });
                if (stored.status === "inserted" || stored.status === "updated") {
                    writtenVerifiedCandidates += 1;
                }
            }
        }
    }

    console.log("Summary:");
    console.log(`- candidates validated successfully: ${validatedSuccess}`);
    console.log(`- rejected candidates: ${rejectedCandidates}`);
    console.log(`- ambiguous candidates: ${ambiguousCandidates}`);
    console.log(`- written verified candidates: ${writtenVerifiedCandidates}`);
    console.log(`- remaining without .DE: ${Math.max(plan.assetsMissingDe - writtenVerifiedCandidates, 0)}`);
    console.log(`- DB writes: ${options.write ? "enabled (--write)" : "disabled (dry-run)"}`);
}

run()
    .catch((error) => {
        console.error(`Discover .DE candidates failed: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
