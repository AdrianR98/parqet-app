import { NextResponse } from "next/server";
import { isHistoryPeriod, isStrictIsoDate, type HistoryPeriod } from "../../../../lib/market-data/history-utils";
import { getMarketDataHistory } from "../../../../lib/market-data/service";

function normalizeLookupIsin(value: string): string {
    return value.replace(/\s+/g, "").toUpperCase();
}

function isValidIsin(value: string): boolean {
    return /^[A-Z0-9]{12}$/.test(value);
}

function invalidRequest(message: string) {
    return NextResponse.json(
        {
            ok: false,
            status: "invalid_request",
            message,
        },
        { status: 400 },
    );
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const isin = normalizeLookupIsin(url.searchParams.get("isin") ?? "");
    const periodRaw = (url.searchParams.get("period") ?? "MAX").trim().toUpperCase();
    const fromRaw = (url.searchParams.get("from") ?? "").trim();
    const toRaw = (url.searchParams.get("to") ?? "").trim();

    if (!isin || !isValidIsin(isin)) {
        return invalidRequest("Ungültige ISIN.");
    }

    if (!isHistoryPeriod(periodRaw)) {
        return invalidRequest("Ungültiger period-Parameter. Erlaubt: 1M, 3M, 6M, 1Y, 3Y, 5Y, MAX.");
    }

    if (fromRaw && !isStrictIsoDate(fromRaw)) {
        return invalidRequest("Ungültiger from-Parameter. Erwartet wird YYYY-MM-DD.");
    }

    if (toRaw && !isStrictIsoDate(toRaw)) {
        return invalidRequest("Ungültiger to-Parameter. Erwartet wird YYYY-MM-DD.");
    }

    if (fromRaw && toRaw && fromRaw > toRaw) {
        return invalidRequest("Ungültiger Zeitraum: from darf nicht nach to liegen.");
    }

    const result = await getMarketDataHistory({
        isin,
        period: periodRaw as HistoryPeriod,
        fromDate: fromRaw || undefined,
        toDate: toRaw || undefined,
    });

    if (result.status === "invalid_request") {
        return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
}
