import { NextResponse } from "next/server";
import { buildAdminSession } from "../../../../../lib/admin/session";
import { getAdminUnmappedMarketData } from "../../../../../lib/market-data/db/admin-unmapped";

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
        const payload = await getAdminUnmappedMarketData({
            limit: searchParams.get("limit"),
            category: searchParams.get("category"),
            action: searchParams.get("action"),
            status: searchParams.get("status"),
        });

        return jsonNoStore(payload, 200);
    } catch {
        return jsonNoStore({ error: "Market data unmapped list unavailable." }, 500);
    }
}
