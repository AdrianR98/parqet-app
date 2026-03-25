"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

const THEME_STORAGE_KEY = "parqet-theme-v1";

type ThemeMode = "dark" | "light";

type ThemeStyle = CSSProperties & {
    "--page-bg": string;
    "--page-bg-secondary": string;
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

function getInitialTheme(): ThemeMode {
    if (typeof window === "undefined") {
        return "dark";
    }

    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

        if (stored === "dark" || stored === "light") {
            return stored;
        }
    } catch {
        // localStorage-Probleme bewusst ignorieren
    }

    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
        return "light";
    }

    return "dark";
}

export function useTheme() {
    const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            // localStorage-Probleme bewusst ignorieren
        }

        document.documentElement.style.colorScheme = theme;
    }, [theme]);

    const themeStyle = useMemo<ThemeStyle>(() => {
        if (theme === "light") {
            return {
                "--page-bg": "#f5f7fb",
                "--page-bg-secondary": "#ecf1f7",
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
    }, [theme]);

    function toggleTheme() {
        setTheme((current) => (current === "dark" ? "light" : "dark"));
    }

    return {
        theme,
        setTheme,
        toggleTheme,
        themeStyle,
    };
}
