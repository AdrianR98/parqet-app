import { describe, expect, it } from "vitest";
import { POST, isSameOriginDisconnectRequest } from "../../src/app/api/auth/disconnect/route";

function createDisconnectRequest(headers: HeadersInit = {}): Request {
    return new Request("http://localhost:3000/api/auth/disconnect", {
        method: "POST",
        headers,
    });
}

describe("auth disconnect route", () => {
    it("accepts same-origin Origin header and clears Parqet cookies", async () => {
        const request = createDisconnectRequest({ Origin: "http://localhost:3000" });
        const response = await POST(request);
        const payload = await response.json();
        const setCookie = response.headers.get("set-cookie") ?? "";

        expect(response.status).toBe(200);
        expect(payload).toEqual({ ok: true });
        expect(setCookie).toContain("parqet_access_token=");
        expect(setCookie).toContain("parqet_refresh_token=");
        expect(setCookie).toContain("parqet_oauth_state=");
        expect(setCookie).toContain("parqet_oauth_code_verifier=");
    });

    it("rejects cross-origin Origin header", async () => {
        const request = createDisconnectRequest({ Origin: "https://evil.example" });
        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(403);
        expect(payload).toEqual({ ok: false, error: "forbidden" });
    });

    it("accepts missing Origin when Referer is same-origin", async () => {
        const request = createDisconnectRequest({ Referer: "http://localhost:3000/settings" });
        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({ ok: true });
    });

    it("rejects cross-origin Referer when Origin is missing", async () => {
        const request = createDisconnectRequest({ Referer: "https://evil.example/settings" });
        const response = await POST(request);
        const payload = await response.json();

        expect(response.status).toBe(403);
        expect(payload).toEqual({ ok: false, error: "forbidden" });
    });

    it("allows requests without Origin and Referer for compatibility", () => {
        const request = createDisconnectRequest();
        expect(isSameOriginDisconnectRequest(request)).toBe(true);
    });
});
