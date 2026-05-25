import { describe, expect, it } from "vitest";
import { buildAdminSession, isWritePermission } from "../../src/lib/admin/session";

describe("admin session guard", () => {
    it("returns disabled defaults when env is missing", () => {
        const session = buildAdminSession(undefined);

        expect(session.authenticated).toBe(false);
        expect(session.admin).toBe(false);
        expect(session.readonly).toBe(true);
        expect(session.roles).toEqual([]);
        expect(session.permissions).toEqual([]);
        expect(session.reason).toBe("disabled");
    });

    it("returns enabled readonly session when ADMIN_ENABLED is true", () => {
        const session = buildAdminSession("true");

        expect(session.authenticated).toBe(true);
        expect(session.admin).toBe(true);
        expect(session.readonly).toBe(true);
        expect(session.reason).toBe("enabled_readonly");
        expect(session.permissions.some((permission) => isWritePermission(permission))).toBe(false);
    });

    it("detects write-like permissions or actions", () => {
        expect(isWritePermission("list")).toBe(false);
        expect(isWritePermission("create")).toBe(true);
        expect(isWritePermission("update")).toBe(true);
        expect(isWritePermission("delete")).toBe(true);
    });
});
