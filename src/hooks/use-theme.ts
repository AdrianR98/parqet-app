"use client";

import { useEffect, useState } from "react";
import {
    APPEARANCE_CHANGE_EVENT,
    loadAppearanceMode,
    saveAppearanceMode,
    type AppearanceMode,
    type ResolvedTheme,
} from "../lib/app-settings";

function subscribeToAppearanceMode(onStoreChange: () => void) {
    if (typeof window === "undefined") {
        return () => {};
    }

    window.addEventListener("storage", onStoreChange);
    window.addEventListener(APPEARANCE_CHANGE_EVENT, onStoreChange);

    return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(APPEARANCE_CHANGE_EVENT, onStoreChange);
    };
}

export function resolveTheme(mode: AppearanceMode, systemTheme: ResolvedTheme): ResolvedTheme {
    return mode === "system" ? systemTheme : mode;
}

export function getNextHeaderThemeMode(
    mode: AppearanceMode,
    resolvedTheme: ResolvedTheme,
): AppearanceMode {
    if (mode === "dark") {
        return "light";
    }

    if (mode === "light") {
        return "dark";
    }

    return resolvedTheme === "dark" ? "light" : "dark";
}

function subscribeToSystemTheme(onStoreChange: () => void) {
    if (typeof window === "undefined") {
        return () => {};
    }

    const query = window.matchMedia?.("(prefers-color-scheme: light)");

    query?.addEventListener("change", onStoreChange);

    return () => query?.removeEventListener("change", onStoreChange);
}

function getSystemThemeSnapshot(): ResolvedTheme {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
        return "light";
    }

    return "dark";
}

function getSystemThemeServerSnapshot(): ResolvedTheme {
    return "dark";
}

export function useTheme() {
    const [appearanceMode, setAppearanceModeState] = useState<AppearanceMode>("system");
    const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemThemeServerSnapshot);

    useEffect(() => {
        const syncAppearanceModeFromStorage = () => {
            const persistedMode = loadAppearanceMode();
            setAppearanceModeState((currentMode) => (
                currentMode === persistedMode ? currentMode : persistedMode
            ));
        };

        syncAppearanceModeFromStorage();
        const unsubscribe = subscribeToAppearanceMode(syncAppearanceModeFromStorage);

        if (typeof window !== "undefined") {
            window.addEventListener("pageshow", syncAppearanceModeFromStorage);
            window.addEventListener("focus", syncAppearanceModeFromStorage);
            document.addEventListener("visibilitychange", syncAppearanceModeFromStorage);
        }

        return () => {
            unsubscribe();
            if (typeof window !== "undefined") {
                window.removeEventListener("pageshow", syncAppearanceModeFromStorage);
                window.removeEventListener("focus", syncAppearanceModeFromStorage);
                document.removeEventListener("visibilitychange", syncAppearanceModeFromStorage);
            }
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const syncSystemTheme = () => {
            const nextTheme = getSystemThemeSnapshot();
            setSystemTheme((currentTheme) => (
                currentTheme === nextTheme ? currentTheme : nextTheme
            ));
        };

        syncSystemTheme();
        const unsubscribe = subscribeToSystemTheme(syncSystemTheme);
        return unsubscribe;
    }, []);

    const resolvedTheme = resolveTheme(appearanceMode, systemTheme);

    function setAppearanceMode(mode: AppearanceMode) {
        saveAppearanceMode(mode);
        setAppearanceModeState(mode);
    }

    function toggleTheme() {
        setAppearanceMode(getNextHeaderThemeMode(appearanceMode, resolvedTheme));
    }

    return {
        appearanceMode,
        resolvedTheme,
        theme: resolvedTheme,
        setAppearanceMode,
        toggleTheme,
    };
}
