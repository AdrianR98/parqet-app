import { NextResponse } from "next/server";
import { buildAdminSession } from "../../../../../lib/admin/session";
import { getAdminMarketInstruments } from "../../../../../lib/market-data/db/admin-instruments";

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
        const payload = await getAdminMarketInstruments({
            limit: searchParams.get("limit"),
            q: searchParams.get("q"),
            status: searchParams.get("status"),
            assetType: searchParams.get("assetType"),
            hasPrimary: searchParams.get("hasPrimary"),
            hasPrices: searchParams.get("hasPrices"),
        });
        return jsonNoStore(payload, 200);
    } catch {
        return jsonNoStore({ error: "Market instruments overview unavailable." }, 500);
    }
}
