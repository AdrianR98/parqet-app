// src/hooks/use-theme.ts

"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

const THEME_STORAGE_KEY = "parqet-theme-v1";

type ThemeMode = "dark" | "light";

/**
 * Eigener Typ fuer CSS-Variablen, damit TypeScript die benutzerdefinierten
 * --foo-Properties sauber akzeptiert.
 */
type ThemeStyle = CSSProperties & {
    "--page-bg": string;
    "--page-bg-secondary": string;
    "--panel-bg": string;
    "--panel-border": string;
    "--text-main": string;
    "--text-soft": string;
    "--accent-cyan": string;
    "--positive": string;
    "--negative": string;
};

/**
 * Liefert den bevorzugten Theme-Modus:
 * 1. localStorage
 * 2. Betriebssystem / Browser-Praeferenz
 * 3. Fallback = dark
 *
 * Wichtig:
 * Diese Funktion ist fuer einen Lazy Initializer gedacht und darf deshalb
 * direkt beim initialen useState-Aufruf verwendet werden.
 */
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

/**
 * Theme-Hook fuer das Dashboard.
 *
 * Aufgaben:
 * - Theme-Zustand verwalten
 * - Auswahl persistent speichern
 * - passende CSS-Variablen fuer Dark/Light bereitstellen
 * - Browser color-scheme synchronisieren
 */
export function useTheme() {
    /**
     * Der Initialwert wird direkt lazy aus Browser-Praeferenz / localStorage
     * bestimmt. Dadurch brauchen wir keinen separaten Effekt mit setState()
     * beim Mount und vermeiden die ESLint-Warnung.
     */
    const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());

    /**
     * Theme persistent speichern und den Browser-Hinweis fuer Formulare,
     * Scrollbars etc. setzen.
     */
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

    /**
     * CSS-Variablen fuer das gesamte Dashboard.
     *
     * Wichtig:
     * Diese Variablen werden direkt am <main>-Wrapper gesetzt.
     * Dadurch greifen sie automatisch in allen Child-Komponenten, die
     * bereits mit CSS-Variablen arbeiten.
     */
    const themeStyle = useMemo<ThemeStyle>(() => {
        if (theme === "light") {
            return {
                "--page-bg": "#f3f6fb",
                "--page-bg-secondary": "#e8eef7",
                "--panel-bg": "#ffffff",
                "--panel-border": "#d6e0ec",
                "--text-main": "#122033",
                "--text-soft": "#5e7085",
                "--accent-cyan": "#0d8fa1",
                "--positive": "#117a43",
                "--negative": "#c43d3d",
                background:
                    "linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-secondary) 100%)",
                color: "var(--text-main)",
                minHeight: "100vh",
            };
        }

        return {
            "--page-bg": "#08111f",
            "--page-bg-secondary": "#0b1730",
            "--panel-bg": "#0f1e33",
            "--panel-border": "#20354f",
            "--text-main": "#eef4fb",
            "--text-soft": "#8ea0b5",
            "--accent-cyan": "#1ab2c0",
            "--positive": "#36c275",
            "--negative": "#ff6b6b",
            background:
                "linear-gradient(180deg, var(--page-bg) 0%, var(--page-bg-secondary) 100%)",
            color: "var(--text-main)",
            minHeight: "100vh",
        };
    }, [theme]);

    /**
     * Komfortfunktion fuer den Theme-Wechsel im Header.
     */
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