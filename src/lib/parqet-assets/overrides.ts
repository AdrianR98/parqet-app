import type { NormalizedActivity, NormalizedActivityType } from "./normalization";

export type ActivityOverride = {
    activityId: string;
    overrideType?: NormalizedActivityType;
    ignore?: boolean;
};

/**
 * Platzhalter für manuelle Korrekturen.
 *
 * Heute:
 * - file/code-basiert
 *
 * Später:
 * - 1:1 in DB-Tabelle überführbar
 */
const overrides: ActivityOverride[] = [
    // Beispiel:
    // {
    //   activityId: "abc123",
    //   overrideType: "transfer_in",
    // },
];

export function applyOverrides(
    activities: NormalizedActivity[]
): NormalizedActivity[] {
    return activities
        .map((activity) => {
            const override = overrides.find((entry) => entry.activityId === activity.id);

            if (!override) {
                return activity;
            }

            if (override.ignore) {
                return null;
            }

            return {
                ...activity,
                type: override.overrideType ?? activity.type,
            };
        })
        .filter((entry): entry is NormalizedActivity => entry !== null);
}