import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function parseArgs(argv) {
    const options = {
        validate: false,
        write: false,
        passthrough: [],
        help: false,
    };

    for (const token of argv) {
        if (token === "--help") {
            options.help = true;
            continue;
        }
        if (token === "--validate") {
            options.validate = true;
        }
        if (token === "--write") {
            options.write = true;
        }
        options.passthrough.push(token);
    }

    return options;
}

function printHelp() {
    console.log("db:market:resolve-primary");
    console.log("- default: dry-run primary-resolution report from current verified mappings");
    console.log("- --validate: explicit provider validation / candidate discovery flow");
    console.log("- --write: forwarded to the selected underlying workflow");
    console.log("- runtime remains DB-only; provider calls happen only with explicit --validate or downstream --write flows");
    console.log("Advanced/internal helpers remain available for manual candidate operations and special-case conflict handling.");
}

function runTsxScript(scriptRelativePath, args) {
    return new Promise((resolve, reject) => {
        const tsxCliPath = path.resolve(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
        const child = spawn(process.execPath, [tsxCliPath, scriptRelativePath, ...args], {
            cwd: process.cwd(),
            stdio: "inherit",
            env: process.env,
        });

        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`Delegated command failed (${scriptRelativePath}, exit ${code})`));
        });
    });
}

async function run() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    if (options.validate) {
        await runTsxScript("scripts/discover-de-yfinance-candidates.mjs", options.passthrough);
        return;
    }

    await runTsxScript("scripts/prefer-de-yfinance-primary-mappings.mjs", options.passthrough);
}

export { parseArgs };

const isDirectExecution = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;

if (isDirectExecution) {
    run().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
