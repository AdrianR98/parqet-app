import { NextResponse } from "next/server";
import { getMarketDataHistory } from "../../../../lib/market-data/service";

function normalizeLookupIsin(value: string): string {
    return value.replace(/\s+/g, "").toUpperCase();
}

function isValidIsin(value: string): boolean {
    return /^[A-Z0-9]{12}$/.test(value);
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const isin = normalizeLookupIsin(url.searchParams.get("isin") ?? "");

    if (!isin || !isValidIsin(isin)) {
        return NextResponse.json(
            {
                ok: false,
                status: "invalid_request",
                message: "Ungültige ISIN.",
            },
            { status: 400 },
        );
    }

    const result = await getMarketDataHistory({ isin });

    if (result.status === "invalid_request") {
        return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
}
