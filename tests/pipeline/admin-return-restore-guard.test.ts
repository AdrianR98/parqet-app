import { describe, expect, it } from "vitest";
import { isNormalAppRoute, shouldReloadAfterAdminReturn } from "../../src/lib/admin-return-restore-guard";

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

    it("does not reload nested admin routes", () => {
        expect(shouldReloadAfterAdminReturn({
            pathname: "/admin/market-data",
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

    it("does not reload admin api routes", () => {
        expect(shouldReloadAfterAdminReturn({
            pathname: "/api/admin/session",
            pending: "1",
            reloadedFor: null,
        })).toEqual({ shouldReload: false, shouldClearMarker: false });
    });

    it("does not reload internal framework routes", () => {
        expect(shouldReloadAfterAdminReturn({
            pathname: "/_next/static/chunk.js",
            pending: "1",
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

describe("isNormalAppRoute", () => {
    it("returns true for app routes, including trailing slash", () => {
        expect(isNormalAppRoute("/settings")).toBe(true);
        expect(isNormalAppRoute("/settings/")).toBe(true);
        expect(isNormalAppRoute("/assets/US0378331005")).toBe(true);
    });

    it("returns false for excluded routes", () => {
        expect(isNormalAppRoute("/admin")).toBe(false);
        expect(isNormalAppRoute("/api/admin/session")).toBe(false);
        expect(isNormalAppRoute("/_next/static/chunk.js")).toBe(false);
        expect(isNormalAppRoute("/favicon.ico")).toBe(false);
    });
});
