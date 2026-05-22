import { NextResponse } from "next/server";
import { getMarketDataHistory } from "../../../../lib/market-data/service";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const isin = (url.searchParams.get("isin") ?? "").trim();
    const refresh = url.searchParams.get("refresh") === "1";

    if (!isin) {
        return NextResponse.json(
            {
                ok: false,
                status: "invalid_request",
                message: "Ungültige ISIN.",
            },
            { status: 400 },
        );
    }

    const result = await getMarketDataHistory({ isin, refresh });

    if (result.status === "invalid_request") {
        return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
}
