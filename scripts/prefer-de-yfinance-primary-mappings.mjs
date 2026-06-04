import { mkdtemp, readFile, rm } from "node:fs/promises";
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
        replaceHistory: false,
        limit: null,
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
        if (token === "--replace-history") {
            options.replaceHistory = true;
            continue;
        }
        if (token === "--limit") {
            options.limit = parsePositiveInt(args.shift(), null, "--limit");
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

    if (options.replaceHistory && !options.write) {
        throw new Error("--replace-history requires --write.");
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

async function exportFullHistory({ python, isin, displayName, symbol }) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "parqet-prefer-de-"));
    const outPath = path.join(tempDir, `${isin}-${symbol}.json`);

    try {
        await runCommand(
            python,
            [
                "scripts/yfinance/export-history.py",
                "--symbol",
                symbol,
                "--isin",
                isin,
                "--name",
                displayName ?? isin,
                "--out",
                outPath,
                "--period",
                "max",
            ],
            `yfinance export ${isin}/${symbol}`,
        );

        const payload = JSON.parse(await readFile(outPath, "utf8"));
        const prices = Array.isArray(payload?.prices) ? payload.prices : [];
        const validPrices = prices
            .filter((point) => point && /^\d{4}-\d{2}-\d{2}$/.test(String(point.date ?? "")) && Number.isFinite(Number(point.close)))
            .map((point) => ({
                date: String(point.date),
                open: point.open ?? null,
                high: point.high ?? null,
                low: point.low ?? null,
                close: Number(point.close),
                adjClose: point.adjClose ?? null,
                volume: point.volume ?? null,
                currency: point.currency ?? payload?.mapping?.currency ?? null,
            }));

        if (validPrices.length === 0) {
            throw new Error("Replacement history is empty.");
        }

        return {
            currency: payload?.mapping?.currency ?? null,
            points: validPrices,
        };
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}

function printPlanSummary({ plan, limitedCandidates, mode }) {
    console.log("Prefer .DE Primary Mapping Report");
    console.log(`- mode: ${mode}`);
    console.log(`- provider calls: ${mode === "dry-run" ? "disabled" : "enabled only with --write --replace-history"}`);
    console.log(`- total assets inspected: ${plan.totalAssetsInspected}`);
    console.log(`- already primary .DE: ${plan.alreadyPrimaryDe}`);
    console.log(`- switch candidates non-DE -> .DE: ${limitedCandidates.length}`);
    console.log(`- actionable unknown inspected: ${plan.actionableUnknownInspected}`);
    console.log(`- no .DE candidate: ${plan.noDeCandidate}`);
    console.log(`- skipped terminal/excluded/legacy/derivative assets: ${plan.skippedNonActionable}`);
    console.log(`- assets requiring full history replacement: ${limitedCandidates.filter((item) => item.requiresFullHistoryReplacement).length}`);
    console.log("- delete scope limitation: asset_daily_prices does not store the original yfinance symbol, so replacement deletes by asset + provider before inserting the full new .DE history.");
}

function printCandidate(candidate) {
    console.log(`- assetId: ${candidate.assetId}`);
    console.log(`  isin: ${candidate.isin}`);
    console.log(`  displayName: ${candidate.displayName ?? "-"}`);
    console.log(`  oldPrimarySymbol: ${candidate.oldPrimarySymbol ?? "-"}`);
    console.log(`  oldPrimaryMappingId: ${candidate.oldPrimaryMappingId ?? "-"}`);
    console.log(`  oldPrimaryExchange: ${candidate.oldPrimaryExchange ?? "-"}`);
    console.log(`  oldPrimaryCurrency: ${candidate.oldPrimaryCurrency ?? "-"}`);
    console.log(`  newPrimarySymbol: ${candidate.newPrimarySymbol}`);
    console.log(`  newPrimaryMappingId: ${candidate.newPrimaryMappingId}`);
    console.log(`  newPrimaryExchange: ${candidate.newPrimaryExchange ?? "-"}`);
    console.log(`  newPrimaryCurrency: ${candidate.newPrimaryCurrency ?? "-"}`);
    console.log(`  oldAssetDailyPriceRowCountToDelete: ${candidate.oldPriceRowCountToDelete}`);
    console.log(`  existingNewDePriceRowCount: ${candidate.existingNewPriceRowCount ?? "not_distinguishable"}`);
    console.log(`  requiresFullHistoryReplacement: ${candidate.requiresFullHistoryReplacement}`);
    console.log(`  isCurrencyFix: ${candidate.isCurrencyFix}`);
    console.log(`  isVenueOnlySwitch: ${candidate.isVenueOnlySwitch}`);
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
        listMarketInstruments,
        listSymbolMappingsForPrimaryPreference,
        replacePrimaryMappingPriceHistory,
        setPrimarySymbolMappingByIsin,
    } = await import("../src/lib/market-data/db/repository-core.ts");
    const { buildDePrimaryPreferencePlan } = await import("../src/lib/market-data/prefer-de-primary.ts");

    const allInstruments = await listMarketInstruments({ limit: 50000 });
    const filteredInstruments = allInstruments.filter((instrument) => {
        const isin = normalizeIsin(instrument.isin);
        if (options.isins.size > 0 && !options.isins.has(isin)) return false;
        if (options.excludeIsins.has(isin)) return false;
        return true;
    });

    const mappings = await listSymbolMappingsForPrimaryPreference("yfinance");
    const filteredMappings = mappings.filter((mapping) => {
        const isin = normalizeIsin(mapping.isin);
        if (options.isins.size > 0 && !options.isins.has(isin)) return false;
        if (options.excludeIsins.has(isin)) return false;
        return true;
    });

    const plan = buildDePrimaryPreferencePlan({
        instruments: filteredInstruments,
        mappings: filteredMappings,
    });

    const limitedCandidates = options.limit ? plan.switchCandidates.slice(0, options.limit) : plan.switchCandidates;
    printPlanSummary({
        plan,
        limitedCandidates,
        mode: options.write ? (options.replaceHistory ? "write + replace-history" : "write") : "dry-run",
    });

    if (limitedCandidates.length > 0) {
        console.log("Switch candidates:");
        for (const candidate of limitedCandidates) {
            printCandidate(candidate);
        }
    }

    if (!options.write) {
        console.log("Summary:");
        console.log("- DB writes: disabled (dry-run)");
        return;
    }

    const blockingCandidates = limitedCandidates.filter(
        (candidate) => candidate.requiresFullHistoryReplacement && candidate.oldPriceRowCountToDelete > 0,
    );
    if (blockingCandidates.length > 0 && !options.replaceHistory) {
        throw new Error(
            `Refusing --write without --replace-history. ${blockingCandidates.length} candidate(s) need destructive full-history replacement before the primary mapping can switch.`,
        );
    }

    const replacementPayloads = new Map();
    if (options.replaceHistory) {
        for (const candidate of limitedCandidates.filter((item) => item.requiresFullHistoryReplacement)) {
            const payload = await exportFullHistory({
                python: options.python,
                isin: candidate.isin,
                displayName: candidate.displayName,
                symbol: candidate.newPrimarySymbol,
            });
            replacementPayloads.set(candidate.newPrimaryMappingId, payload);
        }
    }

    let switched = 0;
    let replaced = 0;

    for (const candidate of limitedCandidates) {
        if (candidate.requiresFullHistoryReplacement) {
            const payload = replacementPayloads.get(candidate.newPrimaryMappingId);
            if (!payload) {
                throw new Error(`Missing prepared replacement history for ${candidate.isin} / ${candidate.newPrimarySymbol}.`);
            }

            await replacePrimaryMappingPriceHistory({
                isin: candidate.isin,
                provider: "yfinance",
                targetMappingId: candidate.newPrimaryMappingId,
                noteSuffix: `prefer_de_primary_switch_at=${new Date().toISOString()}; replace_history=true`,
                replacementCurrency: payload.currency ?? candidate.newPrimaryCurrency ?? null,
                replacementPoints: payload.points,
            });
            switched += 1;
            replaced += 1;
            continue;
        }

        await setPrimarySymbolMappingByIsin(
            candidate.isin,
            "yfinance",
            candidate.newPrimarySymbol,
            `prefer_de_primary_switch_at=${new Date().toISOString()}; replace_history=false`,
        );
        switched += 1;
    }

    console.log("Summary:");
    console.log(`- switched primary mappings: ${switched}`);
    console.log(`- full history replacements: ${replaced}`);
    console.log(`- DB writes: enabled (--write${options.replaceHistory ? " --replace-history" : ""})`);
}

run()
    .catch((error) => {
        console.error(`Prefer .DE primary mapping failed: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
