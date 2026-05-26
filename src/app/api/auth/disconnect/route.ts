import { NextResponse } from "next/server";
import {
    clearParqetOAuthFlowCookies,
    clearParqetTokenCookies,
} from "../../../../lib/parqet";

function tryGetOriginFromUrl(urlValue: string | null): string | null {
    if (!urlValue) {
        return null;
    }

    try {
        return new URL(urlValue).origin;
    } catch {
        return null;
    }
}

export function isSameOriginDisconnectRequest(request: Request): boolean {
    const requestOrigin = tryGetOriginFromUrl(request.url);
    if (!requestOrigin) {
        return false;
    }

    const originHeader = request.headers.get("origin");
    if (originHeader !== null) {
        const origin = tryGetOriginFromUrl(originHeader);
        return origin !== null && origin === requestOrigin;
    }

    const refererHeader = request.headers.get("referer");
    if (refererHeader !== null) {
        const refererOrigin = tryGetOriginFromUrl(refererHeader);
        return refererOrigin !== null && refererOrigin === requestOrigin;
    }

    return true;
}

export async function POST(request: Request) {
    if (!isSameOriginDisconnectRequest(request)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true });
    clearParqetTokenCookies(response, { clearRefreshToken: true });
    clearParqetOAuthFlowCookies(response);
    return response;
}
