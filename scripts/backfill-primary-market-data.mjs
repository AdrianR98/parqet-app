import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function parsePositiveInt(raw, fallback) {
    if (raw == null || raw === "") return fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Ungültiger numerischer Parameter: ${raw}`);
    }
    return parsed;
}

function parseListArg(targetSet, rawValue, normalizer) {
    if (!rawValue) return;
    for (const part of String(rawValue).split(",")) {
        const normalized = normalizer(part);
        if (normalized) targetSet.add(normalized);
    }
}

function parseArgs(argv) {
    const options = {
        write: false,
        limit: null,
        isin: null,
        excludeIsins: new Set(),
        period: "max",
        provider: "yfinance",
        skipExisting: true,
        force: false,
        batchSize: 50,
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
            options.limit = parsePositiveInt(args.shift(), null);
            continue;
        }
        if (token === "--isin") {
            options.isin = normalizeIsin(args.shift() ?? "") || null;
            continue;
        }
        if (token === "--exclude-isin") {
            parseListArg(options.excludeIsins, args.shift(), normalizeIsin);
            continue;
        }
        if (token === "--period") {
            options.period = String(args.shift() ?? "max").trim() || "max";
            continue;
        }
        if (token === "--provider") {
            options.provider = String(args.shift() ?? "yfinance").trim().toLowerCase() || "yfinance";
            continue;
        }
        if (token === "--skip-existing") {
            options.skipExisting = true;
            continue;
        }
        if (token === "--force") {
            options.force = true;
            options.skipExisting = false;
            continue;
        }
        if (token === "--batch-size") {
            options.batchSize = parsePositiveInt(args.shift(), 50);
            continue;
        }
        if (token === "--python") {
            options.python = String(args.shift() ?? "python").trim() || "python";
            continue;
        }
    }

    return options;
}

function safeMessage(error) {
    if (error instanceof Error && error.message) return error.message;
    return "Unbekannter Fehler";
}

function sanitizeForFile(value) {
    return String(value ?? "").replace(/[^A-Za-z0-9._-]/g, "_");
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
            reject(new Error(`${label} konnte nicht gestartet werden: ${safeMessage(error)}`));
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }
            reject(new Error(`${label} fehlgeschlagen (exit ${code})`));
        });
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

    const { listPrimaryMappingsForBackfill } = await import("../src/lib/market-data/db/repository-core.ts");

    const rows = await listPrimaryMappingsForBackfill(options.provider, options.isin ?? undefined);

    let scanned = 0;
    let skippedExisting = 0;
    let skippedExcluded = 0;

    let planned = rows.filter((row) => {
        scanned += 1;

        if (options.excludeIsins.has(normalizeIsin(row.isin))) {
            skippedExcluded += 1;
            return false;
        }

        if (!options.force && options.skipExisting && row.hasPrices) {
            skippedExisting += 1;
            return false;
        }

        return true;
    });

    if (options.limit != null) {
        planned = planned.slice(0, options.limit);
    }

    console.log("Planned Backfills:");
    for (const row of planned) {
        console.log(`- ${row.isin} | ${row.symbol} | ${row.exchange ?? "-"} | ${row.currency ?? "-"} | hasPrices=${row.hasPrices} | hasActions=${row.hasActions}`);
    }

    let successCount = 0;
    let failedCount = 0;

    if (options.write) {
        const baseDir = path.resolve(process.cwd(), ".market-data", "backfill");
        await mkdir(baseDir, { recursive: true });

        for (const row of planned) {
            const safeFile = `${sanitizeForFile(row.isin)}-${sanitizeForFile(row.symbol)}.json`;
            const outPath = path.join(baseDir, safeFile);

            try {
                await runCommand(
                    options.python,
                    [
                        "scripts/yfinance/export-history.py",
                        "--symbol",
                        row.symbol,
                        "--isin",
                        row.isin,
                        "--name",
                        row.name ?? row.isin,
                        "--out",
                        outPath,
                        "--period",
                        options.period,
                    ],
                    `yfinance export ${row.isin}/${row.symbol}`,
                );

                await runCommand(
                    "node",
                    [
                        "scripts/import-market-data-json.mjs",
                        outPath,
                        "--batch-size",
                        String(options.batchSize),
                    ],
                    `JSON import ${row.isin}/${row.symbol}`,
                );

                successCount += 1;
                console.log(`Backfill erfolgreich: ${row.isin} / ${row.symbol}`);
            } catch (error) {
                failedCount += 1;
                console.log(`Backfill fehlgeschlagen: ${row.isin} / ${row.symbol} (${safeMessage(error)})`);
            }
        }
    }

    console.log("Summary:");
    console.log(`- scanned primary mappings: ${scanned}`);
    console.log(`- already has prices skipped: ${skippedExisting}`);
    console.log(`- excluded skipped: ${skippedExcluded}`);
    console.log(`- planned: ${planned.length}`);
    console.log(`- DB writes: ${options.write ? `done (success=${successCount}, failed=${failedCount})` : "skipped (dry-run)"}`);
}

run()
    .catch((error) => {
        console.error(`Backfill fehlgeschlagen: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
