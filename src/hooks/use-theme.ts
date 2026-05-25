"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
    APPEARANCE_CHANGE_EVENT,
    loadAppearanceMode,
    saveAppearanceMode,
    type AppearanceMode,
    type ResolvedTheme,
} from "../lib/app-settings";

type ThemeStyle = CSSProperties & {
    "--page-bg": string;
    "--page-bg-secondary": string;
    "--page-bg-2": string;
    "--panel-bg": string;
    "--panel-bg-2": string;
    "--panel-border": string;
    "--accent-cyan-soft": string;
    "--accent-orange": string;
    "--shadow-soft": string;
    "--surface-header": string;
    "--surface-panel": string;
    "--surface-raised": string;
    "--surface-muted": string;
    "--surface-badge": string;
    "--surface-border": string;
    "--surface-border-strong": string;
    "--text-main": string;
    "--text-soft": string;
    "--text-muted": string;
    "--accent-cyan": string;
    "--accent-cyan-strong": string;
    "--positive": string;
    "--negative": string;
    "--interactive-primary-bg": string;
    "--interactive-primary-text": string;
    "--interactive-border": string;
    "--interactive-border-hover": string;
    "--success-surface": string;
    "--warning-text": string;
    "--warning-surface": string;
    "--warning-surface-soft": string;
    "--warning-border": string;
    "--danger-text": string;
    "--danger-surface": string;
    "--danger-border": string;
    "--info-text": string;
    "--info-surface": string;
    "--info-border": string;
    "--avatar-bg": string;
    "--overlay-backdrop": string;
};

function getThemeStyle(theme: ResolvedTheme): ThemeStyle {
    if (theme === "light") {
        return {
            "--page-bg": "#f5f7fb",
            "--page-bg-secondary": "#ecf1f7",
            "--page-bg-2": "#ecf1f7",
            "--panel-bg": "#ffffff",
            "--panel-bg-2": "#f5f7fb",
            "--panel-border": "rgba(16, 32, 51, 0.08)",
            "--accent-cyan-soft": "rgba(15, 159, 176, 0.12)",
            "--accent-orange": "#c57618",
            "--shadow-soft": "0 10px 30px rgba(16, 32, 51, 0.12)",
            "--surface-header": "rgba(255, 255, 255, 0.9)",
            "--surface-panel": "#ffffff",
            "--surface-raised": "#ffffff",
            "--surface-muted": "#f5f7fb",
            "--surface-badge": "rgba(16, 32, 51, 0.06)",
            "--surface-border": "rgba(16, 32, 51, 0.08)",
            "--surface-border-strong": "rgba(16, 32, 51, 0.14)",
            "--text-main": "#142236",
            "--text-soft": "#5f7187",
            "--text-muted": "#79899e",
            "--accent-cyan": "#0f9fb0",
            "--accent-cyan-strong": "#176fbd",
            "--positive": "#19824e",
            "--negative": "#cf4757",
            "--interactive-primary-bg": "#ffffff",
            "--interactive-primary-text": "#142236",
            "--interactive-border": "rgba(16, 32, 51, 0.12)",
            "--interactive-border-hover": "rgba(15, 159, 176, 0.48)",
            "--success-surface": "rgba(25, 130, 78, 0.12)",
            "--warning-text": "#c57618",
            "--warning-surface": "rgba(197, 118, 24, 0.12)",
            "--warning-surface-soft": "rgba(197, 118, 24, 0.08)",
            "--warning-border": "rgba(197, 118, 24, 0.22)",
            "--danger-text": "#c44654",
            "--danger-surface": "rgba(196, 70, 84, 0.12)",
            "--danger-border": "rgba(196, 70, 84, 0.2)",
            "--info-text": "#2869c7",
            "--info-surface": "rgba(40, 105, 199, 0.12)",
            "--info-border": "rgba(40, 105, 199, 0.2)",
            "--avatar-bg": "#5b6fd6",
            "--overlay-backdrop": "rgba(12, 19, 32, 0.28)",
            background:
                "linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-secondary) 100%)",
            color: "var(--text-main)",
            minHeight: "100vh",
        };
    }

    return {
        "--page-bg": "#081325",
        "--page-bg-secondary": "#0b172d",
        "--page-bg-2": "#0b172d",
        "--panel-bg": "#0f1d34",
        "--panel-bg-2": "#10203a",
        "--panel-border": "rgba(255, 255, 255, 0.08)",
        "--accent-cyan-soft": "rgba(25, 181, 195, 0.14)",
        "--accent-orange": "#ffae4d",
        "--shadow-soft": "0 10px 30px rgba(0, 0, 0, 0.22)",
        "--surface-header": "rgba(9, 22, 43, 0.9)",
        "--surface-panel": "#0f1d34",
        "--surface-raised": "#11213a",
        "--surface-muted": "#0b1830",
        "--surface-badge": "rgba(255, 255, 255, 0.08)",
        "--surface-border": "rgba(255, 255, 255, 0.08)",
        "--surface-border-strong": "rgba(255, 255, 255, 0.14)",
        "--text-main": "#eef4fb",
        "--text-soft": "#9eb0c6",
        "--text-muted": "#71829b",
        "--accent-cyan": "#19b5c3",
        "--accent-cyan-strong": "#2a88c8",
        "--positive": "#2fcb7a",
        "--negative": "#ff6b78",
        "--interactive-primary-bg": "#12243f",
        "--interactive-primary-text": "#eef4fb",
        "--interactive-border": "rgba(255, 255, 255, 0.12)",
        "--interactive-border-hover": "rgba(25, 181, 195, 0.55)",
        "--success-surface": "rgba(47, 203, 122, 0.14)",
        "--warning-text": "#ffae4d",
        "--warning-surface": "rgba(255, 174, 77, 0.12)",
        "--warning-surface-soft": "rgba(255, 174, 77, 0.08)",
        "--warning-border": "rgba(255, 174, 77, 0.28)",
        "--danger-text": "#ff7b86",
        "--danger-surface": "rgba(255, 123, 134, 0.12)",
        "--danger-border": "rgba(255, 123, 134, 0.26)",
        "--info-text": "#8eb8ff",
        "--info-surface": "rgba(142, 184, 255, 0.12)",
        "--info-border": "rgba(142, 184, 255, 0.26)",
        "--avatar-bg": "#5b6fd6",
        "--overlay-backdrop": "rgba(3, 9, 18, 0.58)",
        background:
            "linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-secondary) 100%)",
        color: "var(--text-main)",
        minHeight: "100vh",
    };
}

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

function applyResolvedAppearanceMode(theme: ResolvedTheme): void {
    if (typeof document === "undefined") {
        return;
    }

    document.documentElement.dataset.assettraceTheme = theme;
    document.documentElement.style.colorScheme = theme;
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

    useEffect(() => {
        applyResolvedAppearanceMode(resolvedTheme);
    }, [resolvedTheme]);

    function setAppearanceMode(mode: AppearanceMode) {
        saveAppearanceMode(mode);
        setAppearanceModeState(mode);
    }

    function toggleTheme() {
        setAppearanceMode(getNextHeaderThemeMode(appearanceMode, resolvedTheme));
    }

    const themeStyle = useMemo<ThemeStyle>(() => getThemeStyle(resolvedTheme), [resolvedTheme]);

    return {
        appearanceMode,
        resolvedTheme,
        theme: resolvedTheme,
        setAppearanceMode,
        toggleTheme,
        themeStyle,
    };
}
