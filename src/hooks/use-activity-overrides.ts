// src/hooks/use-activity-overrides.ts

"use client";

import { useCallback, useState } from "react";
import type {
    ActivityOverride,
    ActivityOverrideField,
    ActivityOverrideValue,
    ActivityOverridesApiResponse,
    SaveActivityOverrideApiResponse,
} from "../lib/types";

/**
 * ============================================================
 * DEBUG
 * ============================================================
 */
const DEBUG_ACTIVITY_OVERRIDES_HOOK = true;

function debugLog(message: string, payload?: unknown) {
    if (!DEBUG_ACTIVITY_OVERRIDES_HOOK) return;
    console.debug(`[use-activity-overrides] ${message}`, payload ?? "");
}

function debugError(message: string, error: unknown) {
    console.error(`[use-activity-overrides] ${message}`, error);
}

/**
 * ============================================================
 * TYPES
 * ============================================================
 */
type SaveOverrideInput = {
    activityId: string;
    field: ActivityOverrideField;
    value: ActivityOverrideValue;
    reason?: string | null;
};

type DeleteOverrideInput = {
    activityId: string;
    field: ActivityOverrideField;
};

type UseActivityOverridesResult = {
    items: ActivityOverride[];
    loading: boolean;
    saving: boolean;
    deleting: boolean;
    error: string | null;
    lastSavedOverride: ActivityOverride | null;
    loadOverrides: () => Promise<ActivityOverride[]>;
    saveOverride: (input: SaveOverrideInput) => Promise<ActivityOverride>;
    deleteOverride: (input: DeleteOverrideInput) => Promise<boolean>;
    resetState: () => void;
};

/**
 * ============================================================
 * HOOK
 * ============================================================
 */
export function useActivityOverrides(): UseActivityOverridesResult {
    const [items, setItems] = useState<ActivityOverride[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSavedOverride, setLastSavedOverride] =
        useState<ActivityOverride | null>(null);

    const resetState = useCallback(() => {
        debugLog("Resetting hook state");
        setError(null);
        setLastSavedOverride(null);
    }, []);

    /**
     * ------------------------------------------------------------
     * LOAD
     * ------------------------------------------------------------
     */
    const loadOverrides = useCallback(async (): Promise<ActivityOverride[]> => {
        setLoading(true);
        setError(null);

        try {
            debugLog("Loading overrides");

            const response = await fetch("/api/parqet/activity-overrides", {
                method: "GET",
                cache: "no-store",
            });

            const json = (await response.json()) as ActivityOverridesApiResponse;

            if (!response.ok || !json.ok) {
                throw new Error(
                    [json.message, json.details].filter(Boolean).join(" — ") ||
                    "Overrides konnten nicht geladen werden."
                );
            }

            const nextItems = json.items ?? [];
            setItems(nextItems);

            debugLog("Overrides loaded", { count: nextItems.length });
            return nextItems;
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Overrides konnten nicht geladen werden.";

            setError(message);
            debugError("Loading overrides failed", err);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * ------------------------------------------------------------
     * SAVE
     * ------------------------------------------------------------
     */
    const saveOverride = useCallback(
        async (input: SaveOverrideInput): Promise<ActivityOverride> => {
            setSaving(true);
            setError(null);

            try {
                debugLog("Saving override", input);

                const response = await fetch("/api/parqet/activity-overrides", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        activityId: input.activityId,
                        field: input.field,
                        value: input.value,
                        reason: input.reason ?? null,
                    }),
                });

                const json =
                    (await response.json()) as SaveActivityOverrideApiResponse;

                if (!response.ok || !json.ok || !json.item) {
                    throw new Error(
                        [json.message, json.details].filter(Boolean).join(" — ") ||
                        "Override konnte nicht gespeichert werden."
                    );
                }

                setItems((current) => {
                    const next = current.filter(
                        (entry) =>
                            !(
                                entry.activityId === json.item!.activityId &&
                                entry.field === json.item!.field
                            )
                    );

                    next.push(json.item!);
                    return next;
                });

                setLastSavedOverride(json.item);

                debugLog("Override saved", json.item);
                return json.item;
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Override konnte nicht gespeichert werden.";

                setError(message);
                debugError("Saving override failed", err);
                throw err;
            } finally {
                setSaving(false);
            }
        },
        []
    );

    /**
     * ------------------------------------------------------------
     * DELETE
     * ------------------------------------------------------------
     *
     * Entfernt einen Feld-Override und aktualisiert den lokalen State.
     */
    const deleteOverride = useCallback(
        async (input: DeleteOverrideInput): Promise<boolean> => {
            setDeleting(true);
            setError(null);

            try {
                debugLog("Deleting override", input);

                const response = await fetch("/api/parqet/activity-overrides", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        activityId: input.activityId,
                        field: input.field,
                    }),
                });

                const json =
                    (await response.json()) as SaveActivityOverrideApiResponse;

                if (!response.ok || !json.ok) {
                    throw new Error(
                        [json.message, json.details].filter(Boolean).join(" — ") ||
                        "Override konnte nicht gelöscht werden."
                    );
                }

                setItems((current) =>
                    current.filter(
                        (entry) =>
                            !(
                                entry.activityId === input.activityId &&
                                entry.field === input.field
                            )
                    )
                );

                debugLog("Override deleted successfully", {
                    activityId: input.activityId,
                    field: input.field,
                    deleted: json.deleted ?? false,
                });

                return json.deleted ?? false;
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Override konnte nicht gelöscht werden.";

                setError(message);
                debugError("Deleting override failed", err);
                throw err;
            } finally {
                setDeleting(false);
            }
        },
        []
    );

    return {
        items,
        loading,
        saving,
        deleting,
        error,
        lastSavedOverride,
        loadOverrides,
        saveOverride,
        deleteOverride,
        resetState,
    };
}