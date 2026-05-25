import { NextResponse } from "next/server";
import { buildAdminSession } from "../../../../../lib/admin/session";
import { getAdminMarketSymbolMappings } from "../../../../../lib/market-data/db/admin-mappings";

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
        const payload = await getAdminMarketSymbolMappings({
            limit: searchParams.get("limit"),
            q: searchParams.get("q"),
            provider: searchParams.get("provider"),
            verified: searchParams.get("verified"),
            primary: searchParams.get("primary"),
            active: searchParams.get("active"),
            hasPrices: searchParams.get("hasPrices"),
        });

        return jsonNoStore(payload, 200);
    } catch {
        return jsonNoStore({ error: "Market symbol mappings overview unavailable." }, 500);
    }
}
