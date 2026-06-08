import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
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
        currencyFixesOnly: false,
        continueOnError: false,
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
        if (token === "--currency-fixes-only") {
            options.currencyFixesOnly = true;
            continue;
        }
        if (token === "--continue-on-error") {
            options.continueOnError = true;
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

export { parseArgs };

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
        if (prices.length === 0) {
            throw new Error("Provider fetch returned no price rows.");
        }
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
            throw new Error("Fetched rows have no usable date/close values.");
        }

        const normalizedMappingCurrency = String(payload?.mapping?.currency ?? "").trim().toUpperCase() || null;
        const normalizedPointCurrencies = Array.from(
            new Set(
                validPrices
                    .map((point) => String(point.currency ?? "").trim().toUpperCase() || null)
                    .filter((value) => value),
            ),
        );

        if (normalizedMappingCurrency && normalizedPointCurrencies.length > 0 && !normalizedPointCurrencies.includes(normalizedMappingCurrency)) {
            throw new Error(
                `Fetched rows have unexpected currency values. mapping=${normalizedMappingCurrency}; points=${normalizedPointCurrencies.join(",")}`,
            );
        }

        return {
            currency: payload?.mapping?.currency ?? null,
            points: validPrices,
        };
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}

function printPlanSummary({ plan, selection, mode, limit }) {
    console.log("Prefer .DE Primary Mapping Report");
    console.log(`- mode: ${mode}`);
    console.log(`- provider calls: ${mode === "dry-run" ? "disabled" : "enabled only with --write --replace-history"}`);
    console.log(`- total assets inspected: ${plan.totalAssetsInspected}`);
    console.log(`- already primary .DE: ${plan.alreadyPrimaryDe}`);
    console.log(`- switch candidates non-DE -> .DE: ${selection.totalSwitchCandidates}`);
    console.log(`- currency-fix switch candidates: ${selection.currencyFixSwitchCandidates}`);
    console.log(`- venue-only switch candidates: ${selection.venueOnlySwitchCandidates}`);
    console.log(`- selected candidates under current flags: ${selection.selectedCandidates.length}`);
    console.log(`- selected history replacements under current flags: ${selection.selectedHistoryReplacementCount}`);
    console.log(`- total old rows selected for deletion under current flags: ${selection.selectedDeletionRowCount}`);
    console.log(`- actionable unknown inspected: ${plan.actionableUnknownInspected}`);
    console.log(`- no .DE candidate: ${plan.noDeCandidate}`);
    console.log(`- skipped terminal/excluded/legacy/derivative assets: ${plan.skippedNonActionable}`);
    console.log(`- assets requiring full history replacement: ${plan.assetsRequiringFullHistoryReplacement}`);
    if (limit) {
        console.log(`- selection limit applied: ${selection.selectedCandidates.length}`);
    }
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
    console.log(`  selectionStatus: ${candidate.selectionStatus ?? "selected"}`);
}

function createExecutionSummary(selectedCandidates) {
    return {
        selectedReplacements: selectedCandidates.filter((candidate) => candidate.requiresFullHistoryReplacement).length,
        attemptedReplacements: 0,
        succeededReplacements: 0,
        failedReplacements: 0,
        skippedReplacements: 0,
        primaryMappingsSwitched: 0,
        oldPriceRowsDeleted: 0,
        newPriceRowsInserted: 0,
        latestPricesVerified: 0,
    };
}

function printExecutionSummary(summary) {
    console.log("Execution summary:");
    console.log(`- selected replacements: ${summary.selectedReplacements}`);
    console.log(`- attempted replacements: ${summary.attemptedReplacements}`);
    console.log(`- succeeded replacements: ${summary.succeededReplacements}`);
    console.log(`- failed replacements: ${summary.failedReplacements}`);
    console.log(`- skipped replacements: ${summary.skippedReplacements}`);
    console.log(`- primary mappings switched: ${summary.primaryMappingsSwitched}`);
    console.log(`- old price rows deleted: ${summary.oldPriceRowsDeleted}`);
    console.log(`- new price rows inserted: ${summary.newPriceRowsInserted}`);
    console.log(`- latest prices verified: ${summary.latestPricesVerified}`);
}

function printFailedAssets(failures) {
    if (failures.length === 0) return;
    console.log("Failed assets:");
    for (const failure of failures) {
        console.log(`- isin: ${failure.isin}`);
        console.log(`  displayName: ${failure.displayName ?? "-"}`);
        console.log(`  oldPrimarySymbol: ${failure.oldPrimarySymbol ?? "-"}`);
        console.log(`  newPrimarySymbol: ${failure.newPrimarySymbol}`);
        console.log(`  failureStage: ${failure.failureStage}`);
        console.log(`  failureCode: ${failure.failureCode}`);
        console.log(`  failureReason: ${failure.failureReason}`);
    }
}

function buildPreparationBlocker(candidate, error) {
    const wrapped = new Error(
        `Replacement preparation failed for ${candidate.isin} / ${candidate.newPrimarySymbol}. No DB mutation was performed. ${safeMessage(error)}`,
    );
    wrapped.failureStage = "prepare_history";
    wrapped.failureCode = error?.code ?? "preparation_failed";
    wrapped.failureReason = safeMessage(error);
    return wrapped;
}

function buildExecutionBlocker(candidate, error, summary) {
    const wrapped = new Error(
        `Replacement execution failed for ${candidate.isin} / ${candidate.newPrimarySymbol} after ${summary.primaryMappingsSwitched} primary switch(es). ${safeMessage(error)}`,
    );
    wrapped.failureStage = "replace_history";
    wrapped.failureCode = error?.code ?? "execution_failed";
    wrapped.failureReason = safeMessage(error);
    return wrapped;
}

function describeFailure(candidate, error, failureStage) {
    return {
        isin: candidate.isin,
        displayName: candidate.displayName,
        oldPrimarySymbol: candidate.oldPrimarySymbol,
        newPrimarySymbol: candidate.newPrimarySymbol,
        failureStage,
        failureCode: error?.failureCode ?? error?.code ?? (error?.name === "MarketDataRepositoryError" ? "db_error" : "unknown_error"),
        failureReason: error?.failureReason ?? safeMessage(error),
    };
}

async function executeSelectedCandidates({
    selectedCandidates,
    continueOnError,
    prepareReplacementHistory,
    replacePrimaryMappingPriceHistory,
    setPrimarySymbolMappingByIsin,
    nowIso,
    skippedReplacements = 0,
}) {
    const executionSummary = createExecutionSummary(selectedCandidates);
    executionSummary.skippedReplacements = skippedReplacements;
    const failures = [];

    for (const candidate of selectedCandidates) {
        if (candidate.requiresFullHistoryReplacement) {
            executionSummary.attemptedReplacements += 1;
            let payload;
            try {
                payload = await prepareReplacementHistory(candidate);
            } catch (error) {
                const wrappedError = buildPreparationBlocker(candidate, error);
                const failure = describeFailure(candidate, wrappedError, "prepare_history");
                executionSummary.failedReplacements += 1;
                failures.push(failure);
                if (!continueOnError) {
                    throw { error: wrappedError, summary: executionSummary, failures };
                }
                continue;
            }

            try {
                const result = await replacePrimaryMappingPriceHistory({
                    isin: candidate.isin,
                    provider: "yfinance",
                    targetMappingId: candidate.newPrimaryMappingId,
                    noteSuffix: `prefer_de_primary_switch_at=${nowIso}; replace_history=true`,
                    replacementCurrency: payload.currency ?? candidate.newPrimaryCurrency ?? null,
                    replacementPoints: payload.points,
                });
                executionSummary.succeededReplacements += 1;
                executionSummary.primaryMappingsSwitched += 1;
                executionSummary.oldPriceRowsDeleted += result.deletedPriceRows;
                executionSummary.newPriceRowsInserted += result.insertedPriceRows;
                if (result.latestPriceDate) {
                    executionSummary.latestPricesVerified += 1;
                }
            } catch (error) {
                executionSummary.failedReplacements += 1;
                const failure = describeFailure(candidate, error, "replace_history");
                failures.push(failure);
                if (!continueOnError) {
                    throw { error: buildExecutionBlocker(candidate, error, executionSummary), summary: executionSummary, failures };
                }
            }
            continue;
        }

        try {
            await setPrimarySymbolMappingByIsin(
                candidate.isin,
                "yfinance",
                candidate.newPrimarySymbol,
                `prefer_de_primary_switch_at=${nowIso}; replace_history=false`,
            );
            executionSummary.primaryMappingsSwitched += 1;
        } catch (error) {
            const failure = describeFailure(candidate, error, "switch_primary");
            failures.push(failure);
            if (!continueOnError) {
                throw { error, summary: executionSummary, failures };
            }
        }
    }

    return { executionSummary, failures };
}

export { executeSelectedCandidates };

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
    const { buildDePrimaryPreferencePlan, buildDePrimaryPreferenceSelection } = await import("../src/lib/market-data/prefer-de-primary.ts");

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

    const selection = buildDePrimaryPreferenceSelection({
        plan,
        currencyFixesOnly: options.currencyFixesOnly,
        limit: options.limit,
    });
    printPlanSummary({
        plan,
        selection,
        mode: options.write ? (options.replaceHistory ? "write + replace-history" : "write") : "dry-run",
        limit: options.limit,
    });

    if (selection.candidates.length > 0) {
        console.log("Switch candidates:");
        for (const candidate of selection.candidates) {
            printCandidate(candidate);
        }
    }

    if (!options.write) {
        console.log("Summary:");
        console.log("- DB writes: disabled (dry-run)");
        return;
    }

    if (selection.selectedCandidates.length === 0) {
        const executionSummary = createExecutionSummary(selection.selectedCandidates);
        printExecutionSummary(executionSummary);
        console.log("Summary:");
        console.log(`- DB writes: enabled (--write${options.replaceHistory ? " --replace-history" : ""})`);
        return;
    }

    const blockingCandidates = selection.selectedCandidates.filter(
        (candidate) => candidate.requiresFullHistoryReplacement && candidate.oldPriceRowCountToDelete > 0,
    );
    if (blockingCandidates.length > 0 && !options.replaceHistory) {
        throw new Error(
            `Refusing --write without --replace-history. ${blockingCandidates.length} candidate(s) need destructive full-history replacement before the primary mapping can switch.`,
        );
    }

    const skippedReplacements = selection.candidates.filter(
        (candidate) => candidate.requiresFullHistoryReplacement && candidate.selectionStatus !== "selected",
    ).length;
    const nowIso = new Date().toISOString();
    let executionSummary;
    let failures;
    try {
        ({ executionSummary, failures } = await executeSelectedCandidates({
            selectedCandidates: selection.selectedCandidates,
            continueOnError: options.continueOnError,
            prepareReplacementHistory: async (candidate) => {
                if (!options.replaceHistory) {
                    const error = new Error(`Missing prepared replacement history for ${candidate.isin} / ${candidate.newPrimarySymbol}.`);
                    error.code = "missing_prepared_history";
                    throw error;
                }
                return exportFullHistory({
                    python: options.python,
                    isin: candidate.isin,
                    displayName: candidate.displayName,
                    symbol: candidate.newPrimarySymbol,
                });
            },
            replacePrimaryMappingPriceHistory,
            setPrimarySymbolMappingByIsin,
            nowIso,
            skippedReplacements,
        }));
    } catch (result) {
        printExecutionSummary(result.summary);
        printFailedAssets(result.failures);
        throw result.error;
    }
    printExecutionSummary(executionSummary);
    printFailedAssets(failures);
    if (failures.length > 0) {
        throw new Error(`Replacement batch completed with ${failures.length} failed asset(s).`);
    }
    console.log("Summary:");
    console.log(`- DB writes: enabled (--write${options.replaceHistory ? " --replace-history" : ""})`);
}

const isDirectExecution = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isDirectExecution) {
    run()
        .catch((error) => {
            console.error(`Prefer .DE primary mapping failed: ${safeMessage(error)}`);
            process.exitCode = 1;
        })
        .finally(async () => {
            await closeDbPool();
        });
}
