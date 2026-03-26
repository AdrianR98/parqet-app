// src/app/api/parqet/activity-overrides/route.ts

import { NextResponse } from "next/server";
import {
    deleteActivityOverrideForField,
    readActivityOverrides,
    replaceActivityOverrideForField,
} from "../../../../lib/parqet-assets/override-store";
import type {
    ActivityOverrideField,
    ActivityOverrideValue,
    ActivityOverridesApiResponse,
    SaveActivityOverrideApiResponse,
} from "../../../../lib/types";

/**
 * ============================================================
 * DEBUG
 * ============================================================
 */
const DEBUG_ACTIVITY_OVERRIDE_ROUTE = true;

function debugLog(message: string, payload?: unknown) {
    if (!DEBUG_ACTIVITY_OVERRIDE_ROUTE) return;
    console.debug(`[activity-overrides-route] ${message}`, payload ?? "");
}

function debugError(message: string, error: unknown) {
    console.error(`[activity-overrides-route] ${message}`, error);
}

/**
 * ============================================================
 * BODY TYPES
 * ============================================================
 */
type SaveOverrideBody = {
    activityId?: string;
    field?: ActivityOverrideField;
    value?: ActivityOverrideValue;
    reason?: string | null;
};

type DeleteOverrideBody = {
    activityId?: string;
    field?: ActivityOverrideField;
};

/**
 * ============================================================
 * GET
 * ============================================================
 */
export async function GET() {
    try {
        const items = await readActivityOverrides();
        debugLog("GET overrides", { count: items.length });

        return NextResponse.json({
            ok: true,
            items,
        } satisfies ActivityOverridesApiResponse);
    } catch (error: unknown) {
        debugError("GET overrides failed", error);

        return NextResponse.json(
            {
                ok: false,
                items: [],
                message: "Could not load activity overrides.",
                details: error instanceof Error ? error.message : String(error),
            } satisfies ActivityOverridesApiResponse,
            { status: 500 }
        );
    }
}

/**
 * ============================================================
 * POST
 * ============================================================
 *
 * Speichert oder ersetzt ein Feld-Override.
 */
export async function POST(req: Request) {
    try {
        const body = (await req.json()) as SaveOverrideBody;
        debugLog("POST override payload", body);

        if (!body.activityId || !body.field) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "activityId and field are required.",
                } satisfies SaveActivityOverrideApiResponse,
                { status: 400 }
            );
        }

        const item = await replaceActivityOverrideForField({
            activityId: body.activityId,
            field: body.field,
            value: body.value ?? null,
            reason: body.reason ?? null,
        });

        debugLog("POST override success", item);

        return NextResponse.json({
            ok: true,
            item,
        } satisfies SaveActivityOverrideApiResponse);
    } catch (error: unknown) {
        debugError("POST override failed", error);

        return NextResponse.json(
            {
                ok: false,
                message: "Could not save activity override.",
                details: error instanceof Error ? error.message : String(error),
            } satisfies SaveActivityOverrideApiResponse,
            { status: 500 }
        );
    }
}

/**
 * ============================================================
 * DELETE
 * ============================================================
 *
 * Entfernt gezielt den Override für activityId + field.
 */
export async function DELETE(req: Request) {
    try {
        const body = (await req.json()) as DeleteOverrideBody;
        debugLog("DELETE override payload", body);

        if (!body.activityId || !body.field) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "activityId and field are required.",
                } satisfies SaveActivityOverrideApiResponse,
                { status: 400 }
            );
        }

        const deleted = await deleteActivityOverrideForField(
            body.activityId,
            body.field
        );

        debugLog("DELETE override result", {
            activityId: body.activityId,
            field: body.field,
            deleted,
        });

        return NextResponse.json({
            ok: true,
            deleted,
            message: deleted
                ? "Override deleted."
                : "No matching override found.",
        } satisfies SaveActivityOverrideApiResponse);
    } catch (error: unknown) {
        debugError("DELETE override failed", error);

        return NextResponse.json(
            {
                ok: false,
                message: "Could not delete activity override.",
                details: error instanceof Error ? error.message : String(error),
            } satisfies SaveActivityOverrideApiResponse,
            { status: 500 }
        );
    }
}