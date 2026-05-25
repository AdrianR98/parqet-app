import { NextResponse } from "next/server";
import {
    clearParqetOAuthFlowCookies,
    clearParqetTokenCookies,
} from "../../../../lib/parqet";

export async function POST() {
    const response = NextResponse.json({ ok: true });
    clearParqetTokenCookies(response, { clearRefreshToken: true });
    clearParqetOAuthFlowCookies(response);
    return response;
}
