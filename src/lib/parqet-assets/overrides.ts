import type {
    ActivityOverride,
    ActivityOverrideField,
    AppliedOverrideMap,
} from "../types";

type OverrideCapableActivity = {
    id: string;
    type?: string | null;
    datetime?: string | null;
    shares?: number | null;
    price?: number | null;
    amount?: number | null;
    amountNet?: number | null;
    portfolioId?: string | null;
    portfolioName?: string | null;
    isin?: string | null;
    name?: string | null;
    symbol?: string | null;
    wkn?: string | null;
};

export type CorrectedActivity<T extends OverrideCapableActivity> = T & {
    hasOverrides: boolean;
    overrideFlags: AppliedOverrideMap;
    appliedOverrides: ActivityOverride[];
};

const NUMERIC_FIELDS: ActivityOverrideField[] = [
    "shares",
    "price",
    "amount",
    "amountNet",
];

function toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
}

function toNullableString(value: unknown): string | null {
    if (value === null || value === undefined) {
        return null;
    }

    return String(value);
}

function applySingleOverride<T extends OverrideCapableActivity>(
    activity: T,
    override: ActivityOverride
): T {
    const field = override.field;

    if (NUMERIC_FIELDS.includes(field)) {
        return {
            ...activity,
            [field]: toNullableNumber(override.value),
        };
    }

    return {
        ...activity,
        [field]: toNullableString(override.value),
    };
}

function buildOverrideIndex(overrides: ActivityOverride[]) {
    const index = new Map<string, ActivityOverride[]>();

    for (const item of overrides) {
        const list = index.get(item.activityId) ?? [];
        list.push(item);
        index.set(item.activityId, list);
    }

    return index;
}

export function applyOverrides<T extends OverrideCapableActivity>(
    activities: T[],
    overrides: ActivityOverride[] = []
): CorrectedActivity<T>[] {
    if (activities.length === 0) {
        return [];
    }

    const overrideIndex = buildOverrideIndex(overrides);

    return activities.map((activity) => {
        const activityOverrides = overrideIndex.get(activity.id) ?? [];

        if (activityOverrides.length === 0) {
            return {
                ...activity,
                hasOverrides: false,
                overrideFlags: {},
                appliedOverrides: [],
            };
        }

        let corrected = { ...activity };
        const overrideFlags: AppliedOverrideMap = {};

        for (const override of activityOverrides) {
            corrected = applySingleOverride(corrected, override);
            overrideFlags[override.field] = true;
        }

        return {
            ...corrected,
            hasOverrides: true,
            overrideFlags,
            appliedOverrides: activityOverrides,
        };
    });
}