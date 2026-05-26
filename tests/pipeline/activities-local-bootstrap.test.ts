import { describe, expect, it } from "vitest";
import {
    shouldAttemptActivitiesLocalBootstrap,
    type LocalBootstrapStatus,
} from "../../src/lib/activities-local-bootstrap";

function decide(
    bootstrapStatus: LocalBootstrapStatus,
    attemptedKey: string | null,
    attemptKey = "scope:all|cache:missing",
    hasLocalData = false,
) {
    return shouldAttemptActivitiesLocalBootstrap({
        hasLocalData,
        bootstrapStatus,
        attemptKey,
        attemptedKey,
    });
}

describe("shouldAttemptActivitiesLocalBootstrap", () => {
    it("starts bootstrap once when local data is missing and key was not attempted", () => {
        expect(decide("idle", null)).toBe(true);
    });

    it("does not attempt while a bootstrap run is already in-flight", () => {
        expect(decide("running", null)).toBe(false);
    });

    it("does not retry the same attempt key after a failure", () => {
        expect(decide("failed", "scope:all|cache:missing")).toBe(false);
    });

    it("allows retry when scope/cache key changed", () => {
        expect(decide("failed", "scope:all|cache:missing", "scope:manual|cache:missing")).toBe(true);
    });

    it("does not attempt when local data is already available", () => {
        expect(decide("idle", null, "scope:all|cache:fresh", true)).toBe(false);
    });
});
