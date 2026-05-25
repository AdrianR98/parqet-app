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
        limit: null,
        isins: new Set(),
        excludeIsins: new Set(),
        daysBack: 10,
        force: false,
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
        if (token === "--days-back") {
            options.daysBack = parsePositiveInt(args.shift(), 10, "--days-back");
            continue;
        }
        if (token === "--force") {
            options.force = true;
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

function shiftDate(dateString, deltaDays) {
    const parsed = new Date(`${dateString}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setUTCDate(parsed.getUTCDate() + deltaDays);
    return parsed.toISOString().slice(0, 10);
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

function filterToStartDate(points, startDate) {
    if (!Array.isArray(points)) return [];
    return points.filter((point) => {
        const date = String(point?.date ?? "");
        return /^\d{4}-\d{2}-\d{2}$/.test(date) && (!startDate || date >= startDate);
    });
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
        addMarketDataRunItem,
        createMarketDataRun,
        finishMarketDataRun,
        getLatestDailyPriceDateByIsin,
        listPrimaryMappingsForBackfill,
        upsertDailyPrices,
        upsertMarketActions,
    } = await import("../src/lib/market-data/db/repository-core.ts");

    let planned = await listPrimaryMappingsForBackfill("yfinance");

    planned = planned.filter((row) => {
        const isin = normalizeIsin(row.isin);
        if (options.isins.size > 0 && !options.isins.has(isin)) return false;
        if (options.excludeIsins.has(isin)) return false;
        return true;
    });

    if (options.limit != null) {
        planned = planned.slice(0, options.limit);
    }

    console.log(`Mode: ${options.write ? "write" : "dry-run"}`);
    console.log(`Planned instruments: ${planned.length}`);
    console.log(`days-back: ${options.daysBack}`);
    console.log(`force: ${options.force ? "enabled" : "disabled"}`);

    let runId = null;
    if (options.write && planned.length > 0) {
        const created = await createMarketDataRun({
            provider: "yfinance",
            runType: "incremental_primary_update",
            requestedSymbols: planned.length,
        });
        runId = created.runId;
    }

    const summary = {
        processed: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        pricesUpserted: 0,
        actionsUpserted: 0,
    };

    for (const row of planned) {
        summary.processed += 1;
        const isin = normalizeIsin(row.isin);
        const latestDate = await getLatestDailyPriceDateByIsin({ isin, provider: "yfinance" });
        const effectiveStart = options.force ? null : latestDate ? shiftDate(latestDate, -options.daysBack) : null;

        console.log(
            `[${isin}] symbol=${row.symbol} latest=${latestDate ?? "none"} start=${effectiveStart ?? "max"} actions=${effectiveStart ?? "max"}`,
        );

        if (!options.write) {
            summary.skipped += 1;
            continue;
        }

        const tempDir = await mkdtemp(path.join(os.tmpdir(), "parqet-market-update-"));
        const outPath = path.join(tempDir, `${isin}-${row.symbol}.json`);

        try {
            const exportArgs = [
                "scripts/yfinance/export-history.py",
                "--symbol",
                row.symbol,
                "--isin",
                isin,
                "--name",
                row.name ?? isin,
                "--out",
                outPath,
            ];

            if (effectiveStart) {
                exportArgs.push("--start", effectiveStart);
            } else {
                exportArgs.push("--period", "max");
            }

            await runCommand(options.python, exportArgs, `yfinance export ${isin}/${row.symbol}`);

            const payload = JSON.parse(await readFile(outPath, "utf8"));
            const prices = filterToStartDate(payload.prices, effectiveStart);
            const actions = filterToStartDate(payload.actions, effectiveStart);

            const pricesResult = await upsertDailyPrices({
                isin,
                provider: "yfinance",
                symbol: row.symbol,
                currency: row.currency ?? null,
                source: "yfinance",
                points: prices.map((point) => ({
                    date: String(point.date),
                    open: point.open ?? null,
                    high: point.high ?? null,
                    low: point.low ?? null,
                    close: Number(point.close),
                    adjClose: point.adjClose ?? null,
                    volume: point.volume ?? null,
                    currency: point.currency ?? row.currency ?? null,
                })),
            });

            const actionsResult = await upsertMarketActions({
                isin,
                provider: "yfinance",
                symbol: row.symbol,
                source: "yfinance",
                actions: actions.map((action) => ({
                    actionType: String(action.actionType ?? "").toLowerCase(),
                    date: String(action.date),
                    amount: action.amount ?? null,
                    ratio: action.ratio ?? null,
                    currency: action.currency ?? row.currency ?? null,
                })),
            });

            if (runId) {
                await addMarketDataRunItem({
                    runId,
                    provider: "yfinance",
                    symbol: row.symbol,
                    status: "success",
                    pointsImported: pricesResult.upserted,
                    actionsImported: actionsResult.upserted,
                    firstDate: prices.length > 0 ? String(prices[0].date) : null,
                    lastDate: prices.length > 0 ? String(prices[prices.length - 1].date) : null,
                });
            }

            summary.pricesUpserted += pricesResult.upserted;
            summary.actionsUpserted += actionsResult.upserted;
            if (pricesResult.upserted > 0 || actionsResult.upserted > 0) {
                summary.updated += 1;
            } else {
                summary.skipped += 1;
            }

            console.log(`[${isin}] success prices=${pricesResult.upserted} actions=${actionsResult.upserted}`);
        } catch (error) {
            summary.failed += 1;
            console.log(`[${isin}] failed ${safeMessage(error)}`);

            if (runId) {
                await addMarketDataRunItem({
                    runId,
                    provider: "yfinance",
                    symbol: row.symbol,
                    status: "failed",
                    pointsImported: 0,
                    actionsImported: 0,
                    errorMessage: safeMessage(error),
                });
            }
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    }

    if (runId) {
        await finishMarketDataRun({
            runId,
            status: summary.failed > 0 ? "partial" : "success",
            successfulSymbols: summary.processed - summary.failed,
            failedSymbols: summary.failed,
            errorMessage: summary.failed > 0 ? `${summary.failed} instrument(s) failed` : null,
        });
    }

    console.log("Summary:");
    console.log(`- processed: ${summary.processed}`);
    console.log(`- updated: ${summary.updated}`);
    console.log(`- skipped: ${summary.skipped}`);
    console.log(`- failed: ${summary.failed}`);
    console.log(`- prices upserted: ${summary.pricesUpserted}`);
    console.log(`- actions upserted: ${summary.actionsUpserted}`);
    console.log(`- DB writes: ${options.write ? "enabled (--write)" : "disabled (dry-run)"}`);
}

run()
    .catch((error) => {
        console.error(`Incremental market-data update failed: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
