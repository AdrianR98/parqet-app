// src/lib/parqet-assets/override-store.ts

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type {
    ActivityOverride,
    ActivityOverrideField,
    ActivityOverrideValue,
} from "../types";

/**
 * ============================================================
 * DEBUG
 * ============================================================
 *
 * Zentraler Debug-Schalter für diesen Store.
 * Falls die Logs später zu viel werden, hier deaktivieren.
 */
const DEBUG_OVERRIDE_STORE = true;

function debugLog(message: string, payload?: unknown) {
    if (!DEBUG_OVERRIDE_STORE) return;
    console.debug(`[override-store] ${message}`, payload ?? "");
}

function debugError(message: string, error: unknown) {
    console.error(`[override-store] ${message}`, error);
}

/**
 * ============================================================
 * DATEIPFAD
 * ============================================================
 */
const OVERRIDES_FILE_PATH = path.join(
    process.cwd(),
    "src",
    "data",
    "activity-overrides.json"
);

/**
 * ============================================================
 * INPUT TYPEN
 * ============================================================
 */
type CreateActivityOverrideInput = {
    activityId: string;
    field: ActivityOverrideField;
    value: ActivityOverrideValue;
    reason?: string | null;
};

/**
 * ============================================================
 * FILE HELPERS
 * ============================================================
 *
 * Typischer Erweiterungspunkt:
 * - später Locking
 * - Migrations
 * - Backup / Versionierung
 */
async function ensureOverridesFileExists() {
    try {
        await fs.access(OVERRIDES_FILE_PATH);
        debugLog("Overrides file exists", { path: OVERRIDES_FILE_PATH });
    } catch {
        debugLog("Overrides file missing, creating new file", {
            path: OVERRIDES_FILE_PATH,
        });

        await fs.mkdir(path.dirname(OVERRIDES_FILE_PATH), { recursive: true });
        await fs.writeFile(OVERRIDES_FILE_PATH, "[]", "utf8");
    }
}

function sanitizeParsedOverrides(value: unknown): ActivityOverride[] {
    if (!Array.isArray(value)) {
        debugLog("Parsed overrides are not an array, returning empty list");
        return [];
    }

    const sanitized = value.filter((item): item is ActivityOverride => {
        if (!item || typeof item !== "object") {
            return false;
        }

        const candidate = item as Partial<ActivityOverride>;

        return (
            typeof candidate.id === "string" &&
            typeof candidate.activityId === "string" &&
            typeof candidate.field === "string" &&
            typeof candidate.createdAt === "string" &&
            candidate.source === "manual"
        );
    });

    debugLog("Sanitized overrides", {
        rawCount: value.length,
        sanitizedCount: sanitized.length,
    });

    return sanitized;
}

/**
 * ============================================================
 * READ
 * ============================================================
 */
export async function readActivityOverrides(): Promise<ActivityOverride[]> {
    await ensureOverridesFileExists();

    try {
        const raw = await fs.readFile(OVERRIDES_FILE_PATH, "utf8");
        const sanitizedRaw = raw.replace(/^\uFEFF/, "");
        const parsed = JSON.parse(sanitizedRaw) as unknown;
        const items = sanitizeParsedOverrides(parsed);

        debugLog("Read overrides", { count: items.length });
        return items;
    } catch (error) {
        debugError("Failed to read overrides", error);
        throw error;
    }
}

async function writeActivityOverrides(items: ActivityOverride[]) {
    await ensureOverridesFileExists();

    try {
        await fs.writeFile(
            OVERRIDES_FILE_PATH,
            JSON.stringify(items, null, 2),
            "utf8"
        );

        debugLog("Wrote overrides", { count: items.length });
    } catch (error) {
        debugError("Failed to write overrides", error);
        throw error;
    }
}

/**
 * ============================================================
 * SAVE / REPLACE
 * ============================================================
 *
 * Designregel:
 * - pro activityId + field bleibt nur ein aktiver Override
 */
export async function replaceActivityOverrideForField(
    input: CreateActivityOverrideInput
): Promise<ActivityOverride> {
    debugLog("Replacing override for field", input);

    const items = await readActivityOverrides();

    const nextItems = items.filter(
        (item) =>
            !(
                item.activityId === input.activityId &&
                item.field === input.field
            )
    );

    const nextItem: ActivityOverride = {
        id: crypto.randomUUID(),
        activityId: input.activityId,
        field: input.field,
        value: input.value,
        reason: input.reason ?? null,
        createdAt: new Date().toISOString(),
        source: "manual",
    };

    nextItems.push(nextItem);
    await writeActivityOverrides(nextItems);

    debugLog("Override replaced", nextItem);
    return nextItem;
}

/**
 * ============================================================
 * DELETE / RESET
 * ============================================================
 *
 * Wichtig:
 * - löscht gezielt genau den Override für activityId + field
 * - Rückgabe = true, wenn etwas entfernt wurde
 *
 * Typischer Erweiterungspunkt:
 * - delete by overrideId
 * - delete all for one activity
 */
export async function deleteActivityOverrideForField(
    activityId: string,
    field: ActivityOverrideField
): Promise<boolean> {
    debugLog("Deleting override for field", { activityId, field });

    const items = await readActivityOverrides();

    const nextItems = items.filter(
        (item) => !(item.activityId === activityId && item.field === field)
    );

    const changed = nextItems.length !== items.length;

    if (!changed) {
        debugLog("No override found to delete", { activityId, field });
        return false;
    }

    await writeActivityOverrides(nextItems);
    debugLog("Override deleted", { activityId, field });

    return true;
}