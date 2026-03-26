import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type {
    ActivityOverride,
    ActivityOverrideField,
    ActivityOverrideValue,
} from "../types";

const OVERRIDES_FILE_PATH = path.join(
    process.cwd(),
    "src",
    "data",
    "activity-overrides.json"
);

type CreateActivityOverrideInput = {
    activityId: string;
    field: ActivityOverrideField;
    value: ActivityOverrideValue;
    reason?: string | null;
};

async function ensureOverridesFileExists() {
    try {
        await fs.access(OVERRIDES_FILE_PATH);
    } catch {
        await fs.mkdir(path.dirname(OVERRIDES_FILE_PATH), { recursive: true });
        await fs.writeFile(OVERRIDES_FILE_PATH, "[]", "utf8");
    }
}

function sanitizeParsedOverrides(value: unknown): ActivityOverride[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is ActivityOverride => {
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
}

export async function readActivityOverrides(): Promise<ActivityOverride[]> {
    await ensureOverridesFileExists();

    const raw = await fs.readFile(OVERRIDES_FILE_PATH, "utf8");
    const sanitizedRaw = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(sanitizedRaw) as unknown;

    return sanitizeParsedOverrides(parsed);
}

async function writeActivityOverrides(items: ActivityOverride[]) {
    await ensureOverridesFileExists();

    await fs.writeFile(
        OVERRIDES_FILE_PATH,
        JSON.stringify(items, null, 2),
        "utf8"
    );
}

export async function replaceActivityOverrideForField(
    input: CreateActivityOverrideInput
): Promise<ActivityOverride> {
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

    return nextItem;
}