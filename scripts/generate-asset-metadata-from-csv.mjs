// ============================================================
// scripts/generate-asset-metadata-from-csv.mjs
// ------------------------------------------------------------
// Erzeugt aus einer lokalen CSV-Datei eine generierte
// TypeScript-Mapping-Datei:
//
//   ISIN -> { name: holdingName }
//
// Ziel:
// - keine externe API notwendig
// - reproduzierbarer Build-Schritt
// - gleiche Metadata-Quelle für Server + Client
// ============================================================

import fs from "node:fs";
import path from "node:path";

// ============================================================
// Konfiguration
// ------------------------------------------------------------
// Lege deine CSV lokal hier ab:
// data/Deine Gesamtansicht-20260324-214212.csv
//
// Die generierte TS-Datei landet hier:
// src/lib/generated/csv-asset-metadata.ts
// ============================================================

const INPUT_FILE = path.resolve(
    process.cwd(),
    "data/Deine Gesamtansicht-20260324-214212.csv"
);

const OUTPUT_FILE = path.resolve(
    process.cwd(),
    "src/lib/generated/csv-asset-metadata.ts"
);

// ============================================================
// Hilfsfunktionen
// ============================================================

function normalizeIsin(value) {
    if (typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toUpperCase();

    if (!normalized) {
        return null;
    }

    // Einfache ISIN-Prüfung:
    // 2 Buchstaben + 9 alphanumerische Zeichen + 1 Prüfziffer
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalized)) {
        return null;
    }

    return normalized;
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

/**
 * Parst eine einzelne CSV-Zeile mit Semikolon-Trennung
 * und Unterstützung für doppelte Quotes.
 */
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

    for (const row of rows) {
        const isin = normalizeIsin(row.identifier);
        const holdingName = sanitizeName(row.holdingname);

        if (!isin || !holdingName) {
            continue;
        }

        const existing = metadataByIsin.get(isin);

        if (!existing) {
            metadataByIsin.set(isin, holdingName);
            continue;
        }

        if (existing !== holdingName) {
            conflicts.push({
                isin,
                existing,
                incoming: holdingName,
            });
        }
    }

    const sortedEntries = [...metadataByIsin.entries()].sort(([a], [b]) =>
        a.localeCompare(b, "en")
    );

    const objectLiteral = Object.fromEntries(
        sortedEntries.map(([isin, name]) => [isin, { name }])
    );

    const fileContent = `// ============================================================
// src/lib/generated/csv-asset-metadata.ts
// ------------------------------------------------------------
// GENERATED FILE - DO NOT EDIT MANUALLY
// Source: ${path.basename(INPUT_FILE)}
// Generated at: ${new Date().toISOString()}
// ============================================================

import type { AssetMetadata } from "../types";

export const CSV_ASSET_METADATA: Record<string, AssetMetadata> = ${JSON.stringify(
        objectLiteral,
        null,
        4
    )};
`;

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, fileContent, "utf8");

    console.log(`Generated metadata entries: ${sortedEntries.length}`);

    if (conflicts.length > 0) {
        console.warn("Conflicting holding names detected for some ISINs:");
        console.warn(JSON.stringify(conflicts, null, 2));
    } else {
        console.log("No ISIN name conflicts detected.");
    }
}

main();