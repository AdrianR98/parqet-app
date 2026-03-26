import { NextResponse } from "next/server";
import type {
    ActivityOverrideField,
    ActivityOverrideValue,
    ActivityOverridesApiResponse,
    SaveActivityOverrideApiResponse,
} from "../../../../lib/types";
import {
    readActivityOverrides,
    replaceActivityOverrideForField,
} from "../../../../lib/parqet-assets/override-store";

type SaveOverrideBody = {
    activityId?: string;
    field?: ActivityOverrideField;
    value?: ActivityOverrideValue;
    reason?: string | null;
};

export async function GET() {
    try {
        const items = await readActivityOverrides();

        return NextResponse.json({
            ok: true,
            items,
        } satisfies ActivityOverridesApiResponse);
    } catch (error: unknown) {
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

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as SaveOverrideBody;

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

        return NextResponse.json({
            ok: true,
            item,
        } satisfies SaveActivityOverrideApiResponse);
    } catch (error: unknown) {
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