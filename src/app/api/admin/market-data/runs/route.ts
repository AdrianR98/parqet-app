import { NextResponse } from "next/server";
import { buildAdminSession } from "../../../../../lib/admin/session";
import { getAdminMarketDataRuns } from "../../../../../lib/market-data/db/admin-runs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonNoStore(payload: unknown, status: number) {
    return NextResponse.json(payload, {
        status,
        headers: NO_STORE_HEADERS,
    });
}

export async function GET(request: Request) {
    const session = buildAdminSession();

    if (!session.admin) {
        return jsonNoStore({ error: "Unauthorized" }, 401);
    }

    const { searchParams } = new URL(request.url);

    try {
        const payload = await getAdminMarketDataRuns({
            limit: searchParams.get("limit"),
            status: searchParams.get("status"),
            runType: searchParams.get("runType"),
            provider: searchParams.get("provider"),
        });

        return jsonNoStore(payload, 200);
    } catch {
        return jsonNoStore({ error: "Market data runs overview unavailable." }, 500);
    }
}
