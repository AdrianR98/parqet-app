import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const DEFAULT_INPUT_PATH = ".market-data/local-assets.json";

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function normalizeCurrency(value) {
    const normalized = String(value ?? "").trim().toUpperCase();
    return normalized || null;
}

function normalizeAssetType(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized || null;
}

function normalizeName(value) {
    const normalized = String(value ?? "").trim();
    return normalized || null;
}

function isValidIsin(value) {
    return /^[A-Z0-9]{12}$/.test(value);
}

function safeMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Unbekannter Fehler";
}

function parsePositiveInt(raw, fallback) {
    if (raw == null || raw === "") {
        return fallback;
    }

    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Ungültiger Wert: ${raw}`);
    }

    return parsed;
}

function parseCliArgs(argv) {
    const options = {
        inputPath: DEFAULT_INPUT_PATH,
        dryRun: true,
        write: false,
        limit: null,
        isin: null,
    };

    const args = [...argv];

    if (args.length > 0 && !args[0].startsWith("--")) {
        options.inputPath = args.shift();
    }

    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--write") {
            options.write = true;
            options.dryRun = false;
            continue;
        }

        if (token === "--dry-run") {
            options.dryRun = true;
            options.write = false;
            continue;
        }

        if (token === "--limit") {
            options.limit = parsePositiveInt(args.shift(), null);
            continue;
        }

        if (token === "--isin") {
            const normalizedIsin = normalizeIsin(args.shift() ?? "");
            if (!isValidIsin(normalizedIsin)) {
                throw new Error("Ungültige ISIN für --isin.");
            }
            options.isin = normalizedIsin;
            continue;
        }
    }

    return options;
}

function pickFirstNonEmpty(values) {
    for (const value of values) {
        const normalized = normalizeName(value);
        if (normalized) {
            return normalized;
        }
    }

    return null;
}

function pickAssetType(asset) {
    return normalizeAssetType(
        asset?.assetType ?? asset?.asset_type ?? asset?.metadata?.assetType ?? asset?.externalMetadata?.assetType ?? asset?.assetMeta?.assetType,
    );
}

function pickCurrency(asset) {
    return normalizeCurrency(
        asset?.currency ?? asset?.metadata?.currency ?? asset?.externalMetadata?.currency ?? asset?.assetMeta?.currency,
    );
}

function extractAssetRecord(asset) {
    const isin = normalizeIsin(asset?.isin ?? "");
    if (!isValidIsin(isin)) {
        return null;
    }

    return {
        isin,
        name: pickFirstNonEmpty([
            asset?.name,
            asset?.displayName,
            asset?.assetName,
            asset?.title,
            asset?.metadata?.name,
            asset?.metadata?.displayName,
            asset?.externalMetadata?.name,
            asset?.assetMeta?.name,
        ]),
        assetType: pickAssetType(asset),
        currency: pickCurrency(asset),
    };
}

function extractAssetsFromPayload(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (!payload || typeof payload !== "object") {
        return [];
    }

    const dashboardLikeAssets = [
        ...(Array.isArray(payload.activeAssets) ? payload.activeAssets : []),
        ...(Array.isArray(payload.closedAssets) ? payload.closedAssets : []),
        ...(Array.isArray(payload.assets) ? payload.assets : []),
    ];

    if (dashboardLikeAssets.length > 0) {
        return dashboardLikeAssets;
    }

    if (Array.isArray(payload.items)) {
        return payload.items;
    }

    return [];
}

function mergeAssetRecord(current, next) {
    if (!current) {
        return next;
    }

    return {
        isin: current.isin,
        name: current.name ?? next.name,
        assetType: current.assetType ?? next.assetType,
        currency: current.currency ?? next.currency,
    };
}

function buildUpsertInput(record, existingInstrument) {
    const mergedName = existingInstrument?.name ?? record.name ?? null;
    const mergedAssetType = existingInstrument?.assetType ?? record.assetType ?? null;
    const mergedCurrency = existingInstrument?.currency ?? record.currency ?? null;

    return {
        isin: record.isin,
        name: mergedName,
        assetType: mergedAssetType,
        currency: mergedCurrency,
    };
}

async function closeDbPool() {
    try {
        const { endPostgresPool } = await import("../src/lib/db/postgres-core.ts");
        await endPostgresPool();
    } catch {
        // no-op
    }
}

async function run() {
    const options = parseCliArgs(process.argv.slice(2));
    const resolvedPath = path.resolve(process.cwd(), options.inputPath);

    if (!existsSync(resolvedPath)) {
        throw new Error(
            `Lokale Asset-Datei nicht gefunden: ${options.inputPath}. Hinweis: Browser-localStorage ist aus Node nicht lesbar. Bitte exportiere Assets nach ${DEFAULT_INPUT_PATH} oder gib einen Pfad an.`,
        );
    }

    const raw = await readFile(resolvedPath, "utf8");
    const parsed = JSON.parse(raw);
    const rawAssets = extractAssetsFromPayload(parsed);

    const recordsByIsin = new Map();
    let invalidIsinCount = 0;

    for (const asset of rawAssets) {
        const record = extractAssetRecord(asset);
        if (!record) {
            invalidIsinCount += 1;
            continue;
        }

        if (options.isin && record.isin !== options.isin) {
            continue;
        }

        const existing = recordsByIsin.get(record.isin);
        recordsByIsin.set(record.isin, mergeAssetRecord(existing, record));
    }

    let records = [...recordsByIsin.values()].sort((a, b) => a.isin.localeCompare(b.isin));
    if (options.limit != null) {
        records = records.slice(0, options.limit);
    }

    const { listMarketInstruments, upsertInstrument } = await import("../src/lib/market-data/db/repository-core.ts");
    const existingInstruments = await listMarketInstruments({ limit: 50000 });
    const existingByIsin = new Map(existingInstruments.map((instrument) => [normalizeIsin(instrument.isin), instrument]));

    let alreadyPresentCount = 0;
    let candidateUpsertCount = 0;
    let wroteCount = 0;
    let skippedCount = 0;

    const preview = [];

    for (const record of records) {
        const existing = existingByIsin.get(record.isin) ?? null;
        const upsertInput = buildUpsertInput(record, existing);

        const wouldChange =
            !existing ||
            (existing.name ?? null) !== (upsertInput.name ?? null) ||
            (existing.assetType ?? null) !== (upsertInput.assetType ?? null) ||
            (existing.currency ?? null) !== (upsertInput.currency ?? null);

        if (existing) {
            alreadyPresentCount += 1;
        }

        if (!wouldChange) {
            skippedCount += 1;
            continue;
        }

        candidateUpsertCount += 1;
        if (preview.length < 20) {
            preview.push(upsertInput);
        }

        if (options.write) {
            await upsertInstrument(upsertInput);
            wroteCount += 1;
        }
    }

    console.log(`Asset-Quelle: ${options.inputPath}`);
    console.log(`Assets gelesen: ${rawAssets.length}`);
    console.log(`Valide ISINs (unique): ${records.length}`);
    console.log(`Ungültige/fehlende ISINs übersprungen: ${invalidIsinCount}`);
    console.log(`Bereits in DB vorhanden: ${alreadyPresentCount}`);
    console.log(`Insert/Update Kandidaten: ${candidateUpsertCount}`);

    if (preview.length > 0) {
        console.log("Beispiel-Kandidaten (max 20):");
        for (const item of preview) {
            console.log(`- ${item.isin} | ${item.name ?? "-"} | ${item.assetType ?? "-"} | ${item.currency ?? "-"}`);
        }
    }

    if (options.write) {
        console.log(`DB Upserts ausgeführt: ${wroteCount}`);
        console.log(`Übersprungen ohne Änderung: ${skippedCount}`);
    } else {
        console.log("Dry-run aktiv: keine DB Writes ausgeführt.");
    }
}

run()
    .catch((error) => {
        console.error(`Instrument-Sync fehlgeschlagen: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
