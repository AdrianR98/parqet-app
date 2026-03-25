// ============================================================
// scripts/generate-asset-metadata-from-csv.mjs
// ------------------------------------------------------------
// Erzeugt aus einer lokalen CSV-Datei:
//
// 1) src/lib/generated/csv-asset-metadata.ts
// 2) src/lib/generated/csv-asset-metadata-report.ts
//
// Ziel:
// - lokale ISIN -> Name Mapping-Datei
// - transparenter Validierungsreport
// - keine externe API notwendig
// ============================================================

import fs from "node:fs";
import path from "node:path";

// ============================================================
// Konfiguration
// ============================================================

const INPUT_FILE = path.resolve(
    process.cwd(),
    "data/Deine Gesamtansicht-20260324-214212.csv"
);

const OUTPUT_METADATA_FILE = path.resolve(
    process.cwd(),
    "src/lib/generated/csv-asset-metadata.ts"
);

const OUTPUT_REPORT_FILE = path.resolve(
    process.cwd(),
    "src/lib/generated/csv-asset-metadata-report.ts"
);

// ============================================================
// Helper
// ============================================================

function normalizeIsin(value) {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toUpperCase();

    if (!normalized) {
        return null;
    }

    return normalized;
}

function isValidIsin(value) {
    const normalized = normalizeIsin(value);

    if (!normalized) {
        return false;
    }

    return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalized);
}

function sanitizeName(value) {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim();

    if (!normalized) {
        return null;
    }

    const lowered = normalized.toLowerCase();

    if (lowered === "undefined" || lowered === "null" || lowered === "n/a") {
        return null;
    }

    return normalized;
}

function parseSemicolonCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }

            continue;
        }

        if (char === ";" && !inQuotes) {
            result.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    result.push(current);

    return result;
}

function parseCsv(content) {
    const normalizedContent = content
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");

    const lines = normalizedContent
        .split("\n")
        .filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
        throw new Error("CSV ist leer.");
    }

    const header = parseSemicolonCsvLine(lines[0]);

    const rows = lines.slice(1).map((line) => {
        const values = parseSemicolonCsvLine(line);
        const row = {};

        for (let index = 0; index < header.length; index += 1) {
            row[header[index]] = values[index] ?? "";
        }

        return row;
    });

    return rows;
}

function writeTsFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
}

// ============================================================
// Hauptlogik
// ============================================================

function main() {
    if (!fs.existsSync(INPUT_FILE)) {
        throw new Error(
            `CSV-Datei nicht gefunden: ${INPUT_FILE}\n` +
            "Lege die Export-Datei unter /data/ ab."
        );
    }

    const raw = fs.readFileSync(INPUT_FILE, "utf8");
    const rows = parseCsv(raw);

    const metadataByIsin = new Map();
    const conflicts = [];

    let skippedRowsMissingIdentifier = 0;
    let skippedRowsInvalidIdentifier = 0;
    let skippedRowsMissingHoldingName = 0;
    let usableRows = 0;

    for (const row of rows) {
        const rawIdentifier = row.identifier;
        const rawHoldingName = row.holdingname;

        const normalizedIsin = normalizeIsin(rawIdentifier);
        const holdingName = sanitizeName(rawHoldingName);

        if (!normalizedIsin) {
            skippedRowsMissingIdentifier += 1;
            continue;
        }

        if (!isValidIsin(normalizedIsin)) {
            skippedRowsInvalidIdentifier += 1;
            continue;
        }

        if (!holdingName) {
            skippedRowsMissingHoldingName += 1;
            continue;
        }

        usableRows += 1;

        const existing = metadataByIsin.get(normalizedIsin);

        if (!existing) {
            metadataByIsin.set(normalizedIsin, holdingName);
            continue;
        }

        if (existing !== holdingName) {
            conflicts.push({
                isin: normalizedIsin,
                existing,
                incoming: holdingName,
            });
        }
    }

    const sortedEntries = [...metadataByIsin.entries()].sort(([a], [b]) =>
        a.localeCompare(b, "en")
    );

    const metadataObject = Object.fromEntries(
        sortedEntries.map(([isin, name]) => [isin, { name }])
    );

    const reportObject = {
        sourceFileName: path.basename(INPUT_FILE),
        generatedAt: new Date().toISOString(),
        totalRows: rows.length,
        usableRows,
        uniqueIsins: sortedEntries.length,
        skippedRowsMissingIdentifier,
        skippedRowsInvalidIdentifier,
        skippedRowsMissingHoldingName,
        conflictingIsins: conflicts,
    };

    const metadataFileContent = `// ============================================================
// src/lib/generated/csv-asset-metadata.ts
// ------------------------------------------------------------
// GENERATED FILE - DO NOT EDIT MANUALLY
// Source: ${path.basename(INPUT_FILE)}
// Generated at: ${new Date().toISOString()}
// ============================================================

import type { AssetMetadata } from "../types";

export const CSV_ASSET_METADATA: Record<string, AssetMetadata> = ${JSON.stringify(
        metadataObject,
        null,
        4
    )};
`;

    const reportFileContent = `// ============================================================
// src/lib/generated/csv-asset-metadata-report.ts
// ------------------------------------------------------------
// GENERATED FILE - DO NOT EDIT MANUALLY
// Source: ${path.basename(INPUT_FILE)}
// Generated at: ${new Date().toISOString()}
// ============================================================

export type CsvAssetMetadataReport = {
    sourceFileName: string;
    generatedAt: string;
    totalRows: number;
    usableRows: number;
    uniqueIsins: number;
    skippedRowsMissingIdentifier: number;
    skippedRowsInvalidIdentifier: number;
    skippedRowsMissingHoldingName: number;
    conflictingIsins: Array<{
        isin: string;
        existing: string;
        incoming: string;
    }>;
};

export const CSV_ASSET_METADATA_REPORT: CsvAssetMetadataReport = ${JSON.stringify(
        reportObject,
        null,
        4
    )};
`;

    writeTsFile(OUTPUT_METADATA_FILE, metadataFileContent);
    writeTsFile(OUTPUT_REPORT_FILE, reportFileContent);

    // ========================================================
    // Konsolenreport
    // ========================================================

    console.log("============================================================");
    console.log("CSV Asset Metadata Generation Report");
    console.log("============================================================");
    console.log(`Source file:                  ${reportObject.sourceFileName}`);
    console.log(`Generated at:                 ${reportObject.generatedAt}`);
    console.log(`Total rows:                   ${reportObject.totalRows}`);
    console.log(`Usable rows:                  ${reportObject.usableRows}`);
    console.log(`Unique ISINs:                 ${reportObject.uniqueIsins}`);
    console.log(`Missing identifier rows:      ${reportObject.skippedRowsMissingIdentifier}`);
    console.log(`Invalid identifier rows:      ${reportObject.skippedRowsInvalidIdentifier}`);
    console.log(`Missing holdingName rows:     ${reportObject.skippedRowsMissingHoldingName}`);
    console.log(`Conflicting ISINs:            ${reportObject.conflictingIsins.length}`);
    console.log("============================================================");

    if (reportObject.conflictingIsins.length > 0) {
        console.warn("Conflicts detected:");
        console.warn(JSON.stringify(reportObject.conflictingIsins, null, 2));
    } else {
        console.log("No ISIN name conflicts detected.");
    }
}

main();