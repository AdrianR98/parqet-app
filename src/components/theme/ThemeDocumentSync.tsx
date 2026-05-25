"use client";

import { useEffect } from "react";
import {
    APPEARANCE_CHANGE_EVENT,
    loadAppearanceMode,
    type ResolvedTheme,
} from "../../lib/app-settings";

function getSystemTheme(): ResolvedTheme {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
        return "light";
    }

    return "dark";
}

function applyThemeToDocument(): void {
    if (typeof document === "undefined") {
        return;
    }

    const appearanceMode = loadAppearanceMode();
    const resolvedTheme = appearanceMode === "system" ? getSystemTheme() : appearanceMode;

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.assettraceTheme = resolvedTheme;
    document.documentElement.dataset.appearance = appearanceMode;
    document.documentElement.style.colorScheme = resolvedTheme;

    if (process.env.NODE_ENV !== "production") {
        console.debug("[theme-sync] applied", { appearanceMode, resolvedTheme });
    }
}

export default function ThemeDocumentSync() {
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const sync = () => applyThemeToDocument();
        sync();

        const query = window.matchMedia?.("(prefers-color-scheme: light)");
        query?.addEventListener("change", sync);
        window.addEventListener("storage", sync);
        window.addEventListener(APPEARANCE_CHANGE_EVENT, sync);
        window.addEventListener("pageshow", sync);
        window.addEventListener("focus", sync);
        document.addEventListener("visibilitychange", sync);

        return () => {
            query?.removeEventListener("change", sync);
            window.removeEventListener("storage", sync);
            window.removeEventListener(APPEARANCE_CHANGE_EVENT, sync);
            window.removeEventListener("pageshow", sync);
            window.removeEventListener("focus", sync);
            document.removeEventListener("visibilitychange", sync);
        };
    }, []);

    return null;
}
