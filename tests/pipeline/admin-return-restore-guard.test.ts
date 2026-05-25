import { describe, expect, it } from "vitest";
import { shouldReloadAfterAdminReturn } from "../../src/lib/admin-return-restore-guard";

describe("shouldReloadAfterAdminReturn", () => {
    it("reloads settings when pending and no route-specific reload guard exists", () => {
        expect(shouldReloadAfterAdminReturn({
            pathname: "/settings",
            pending: "1",
            reloadedFor: null,
        })).toEqual({ shouldReload: true, shouldClearMarker: false });
    });

    it("reloads dashboard when pending and no route-specific reload guard exists", () => {
        expect(shouldReloadAfterAdminReturn({
            pathname: "/dashboard",
            pending: "1",
            reloadedFor: null,
        })).toEqual({ shouldReload: true, shouldClearMarker: false });
    });

    it("reloads activities when pending and no route-specific reload guard exists", () => {
        expect(shouldReloadAfterAdminReturn({
            pathname: "/activities",
            pending: "1",
            reloadedFor: null,
        })).toEqual({ shouldReload: true, shouldClearMarker: false });
    });

    it("reloads asset details when pending and no route-specific reload guard exists", () => {
        expect(shouldReloadAfterAdminReturn({
            pathname: "/assets/US0378331005",
            pending: "1",
            reloadedFor: null,
        })).toEqual({ shouldReload: true, shouldClearMarker: false });
    });

    it("does not reload admin route", () => {
        expect(shouldReloadAfterAdminReturn({
            pathname: "/admin",
            pending: "1",
            reloadedFor: null,
        })).toEqual({ shouldReload: false, shouldClearMarker: false });
    });

    it("does not reload when no pending admin marker exists", () => {
        expect(shouldReloadAfterAdminReturn({
            pathname: "/settings",
            pending: null,
            reloadedFor: null,
        })).toEqual({ shouldReload: false, shouldClearMarker: false });
    });

    it("clears marker instead of reloading when route already reloaded once", () => {
        expect(shouldReloadAfterAdminReturn({
            pathname: "/settings",
            pending: "1",
            reloadedFor: "/settings",
        })).toEqual({ shouldReload: false, shouldClearMarker: true });
    });
});
