import { describe, expect, it } from "vitest";
import { getNextHeaderThemeMode, resolveTheme } from "../../src/hooks/use-theme";

describe("theme mode helpers", () => {
    it("keeps persisted light mode as light", () => {
        expect(resolveTheme("light", "dark")).toBe("light");
    });

    it("keeps persisted dark mode as dark", () => {
        expect(resolveTheme("dark", "light")).toBe("dark");
    });

    it("keeps system mode while resolving with system preference", () => {
        expect(resolveTheme("system", "dark")).toBe("dark");
        expect(resolveTheme("system", "light")).toBe("light");
    });

    it("toggles to light from system when resolved theme is dark", () => {
        expect(getNextHeaderThemeMode("system", "dark")).toBe("light");
    });

    it("toggles to dark from system when resolved theme is light", () => {
        expect(getNextHeaderThemeMode("system", "light")).toBe("dark");
    });
});
