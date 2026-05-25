import { describe, expect, it } from "vitest";
import { POST } from "../../src/app/api/auth/disconnect/route";

describe("auth disconnect route", () => {
    it("returns success and clears Parqet cookies", async () => {
        const response = await POST();
        const payload = await response.json();
        const setCookie = response.headers.get("set-cookie") ?? "";

        expect(response.status).toBe(200);
        expect(payload).toEqual({ ok: true });
        expect(setCookie).toContain("parqet_access_token=");
        expect(setCookie).toContain("parqet_refresh_token=");
        expect(setCookie).toContain("parqet_oauth_state=");
        expect(setCookie).toContain("parqet_oauth_code_verifier=");
    });
});
