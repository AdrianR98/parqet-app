import { afterEach, describe, expect, it, vi } from "vitest";
import {
    APPEARANCE_STORAGE_KEY,
    KNOWN_PORTFOLIOS_STORAGE_KEY,
    PORTFOLIO_SCOPE_STORAGE_KEY,
    clearParqetLocalUserData,
} from "../../src/lib/app-settings";
import { DASHBOARD_CACHE_KEY } from "../../src/lib/dashboard-cache";
import { METADATA_STORAGE_KEY } from "../../src/lib/asset-metadata";

type LocalStorageMock = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
};

function createWindowMock() {
    const store = new Map<string, string>();
    const localStorage: LocalStorageMock = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => {
            store.set(key, value);
        },
        removeItem: (key) => {
            store.delete(key);
        },
    };

    return {
        localStorage,
        dispatchEvent: vi.fn(),
    };
}

describe("clearParqetLocalUserData", () => {
    const originalWindow = globalThis.window;

    afterEach(() => {
        vi.restoreAllMocks();
        if (originalWindow === undefined) {
            delete (globalThis as { window?: Window }).window;
        } else {
            (globalThis as { window?: Window }).window = originalWindow;
        }
    });

    it("clears Parqet-derived local keys and preserves appearance", () => {
        const windowMock = createWindowMock();
        (globalThis as { window?: unknown }).window = windowMock;

        windowMock.localStorage.setItem(DASHBOARD_CACHE_KEY, "{\"ok\":true}");
        windowMock.localStorage.setItem(KNOWN_PORTFOLIOS_STORAGE_KEY, "[{\"id\":\"p1\"}]");
        windowMock.localStorage.setItem(PORTFOLIO_SCOPE_STORAGE_KEY, "{\"mode\":\"all\"}");
        windowMock.localStorage.setItem(METADATA_STORAGE_KEY, "{\"US0000000001\":{}}");
        windowMock.localStorage.setItem(APPEARANCE_STORAGE_KEY, "light");

        clearParqetLocalUserData();

        expect(windowMock.localStorage.getItem(DASHBOARD_CACHE_KEY)).toBeNull();
        expect(windowMock.localStorage.getItem(KNOWN_PORTFOLIOS_STORAGE_KEY)).toBeNull();
        expect(windowMock.localStorage.getItem(PORTFOLIO_SCOPE_STORAGE_KEY)).toBeNull();
        expect(windowMock.localStorage.getItem(METADATA_STORAGE_KEY)).toBeNull();
        expect(windowMock.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe("light");
        expect(windowMock.dispatchEvent).toHaveBeenCalledTimes(2);
    });
});
