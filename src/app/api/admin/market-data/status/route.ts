import { NextResponse } from "next/server";
import { buildAdminSession } from "../../../../../lib/admin/session";
import { getAdminMarketDataStatus } from "../../../../../lib/market-data/db/admin-status";

export async function GET() {
    const session = buildAdminSession();

    if (!session.admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const status = await getAdminMarketDataStatus();
        return NextResponse.json(status, { status: 200 });
    } catch {
        return NextResponse.json({ error: "Market data status unavailable." }, { status: 500 });
    }
}
