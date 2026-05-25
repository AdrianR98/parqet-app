import { describe, expect, it } from "vitest";
import { shouldReloadSettingsAfterAdminReturn } from "../../src/lib/settings-restore-guard";

describe("shouldReloadSettingsAfterAdminReturn", () => {
    it("reloads settings once after admin return marker", () => {
        expect(shouldReloadSettingsAfterAdminReturn({
            pathname: "/settings",
            lastRoute: "/admin",
            visitedAdmin: "1",
            alreadyReloaded: null,
        })).toBe(true);
    });

    it("does not reload settings when already reloaded", () => {
        expect(shouldReloadSettingsAfterAdminReturn({
            pathname: "/settings",
            lastRoute: "/admin",
            visitedAdmin: "1",
            alreadyReloaded: "1",
        })).toBe(false);
    });

    it("does not reload non-settings routes", () => {
        expect(shouldReloadSettingsAfterAdminReturn({
            pathname: "/dashboard",
            lastRoute: "/admin",
            visitedAdmin: "1",
            alreadyReloaded: null,
        })).toBe(false);
    });
});
