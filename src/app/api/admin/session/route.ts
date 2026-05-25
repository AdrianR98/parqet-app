import { NextResponse } from "next/server";
import { buildAdminSession } from "@/lib/admin/session";

export async function GET() {
    const session = buildAdminSession();
    const status = session.admin ? 200 : 401;

    return NextResponse.json(session, { status });
}
