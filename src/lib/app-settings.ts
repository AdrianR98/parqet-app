import type { Portfolio } from "./types";

export const APPEARANCE_STORAGE_KEY = "assettrace-appearance-mode-v1";
export const LEGACY_THEME_STORAGE_KEY = "parqet-theme-v1";
export const PORTFOLIO_SCOPE_STORAGE_KEY = "assettrace-portfolio-scope-v1";
export const KNOWN_PORTFOLIOS_STORAGE_KEY = "assettrace-known-portfolios-v1";

export type AppearanceMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export type PortfolioScope = {
    mode: "all" | "manual";
    selectedPortfolioIds: string[];
};

export type PortfolioScopeResolution = {
    scope: PortfolioScope;
    selectedPortfolioIds: string[];
    missingPortfolioIds: string[];
    usedFallback: boolean;
};

const DEFAULT_PORTFOLIO_SCOPE: PortfolioScope = {
    mode: "all",
    selectedPortfolioIds: [],
};

function isBrowser(): boolean {
    return typeof window !== "undefined";
}

function uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

export function parseAppearanceMode(value: unknown): AppearanceMode {
    if (value === "light" || value === "dark" || value === "system") {
        return value;
    }

    return "system";
}

export function loadAppearanceMode(): AppearanceMode {
    if (!isBrowser()) {
        return "system";
    }

    try {
        const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);

        if (stored !== null) {
            return parseAppearanceMode(stored);
        }

        const legacyTheme = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);

        if (legacyTheme === "light" || legacyTheme === "dark") {
            return legacyTheme;
        }
    } catch {
        // localStorage-Probleme bewusst ignorieren.
    }

    return "system";
}

export function saveAppearanceMode(mode: AppearanceMode): void {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.setItem(APPEARANCE_STORAGE_KEY, mode);
    } catch {
        // localStorage-Probleme bewusst ignorieren.
    }
}

export function resolveAppearanceMode(mode: AppearanceMode): ResolvedTheme {
    if (mode === "light" || mode === "dark") {
        return mode;
    }

    if (isBrowser() && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
        return "light";
    }

    return "dark";
}

export function parsePortfolioScope(value: unknown): PortfolioScope {
    if (!value || typeof value !== "object") {
        return DEFAULT_PORTFOLIO_SCOPE;
    }

    const candidate = value as Partial<PortfolioScope>;

    if (candidate.mode === "manual") {
        return {
            mode: "manual",
            selectedPortfolioIds: uniqueIds(candidate.selectedPortfolioIds ?? []),
        };
    }

    return DEFAULT_PORTFOLIO_SCOPE;
}

export function loadPortfolioScope(): PortfolioScope {
    if (!isBrowser()) {
        return DEFAULT_PORTFOLIO_SCOPE;
    }

    try {
        const raw = window.localStorage.getItem(PORTFOLIO_SCOPE_STORAGE_KEY);

        if (!raw) {
            return DEFAULT_PORTFOLIO_SCOPE;
        }

        return parsePortfolioScope(JSON.parse(raw) as unknown);
    } catch {
        return DEFAULT_PORTFOLIO_SCOPE;
    }
}

export function savePortfolioScope(scope: PortfolioScope): void {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.setItem(PORTFOLIO_SCOPE_STORAGE_KEY, JSON.stringify(parsePortfolioScope(scope)));
    } catch {
        // localStorage-Probleme bewusst ignorieren.
    }
}

export function resolvePortfolioScope(scope: PortfolioScope, portfolios: Pick<Portfolio, "id">[]): PortfolioScopeResolution {
    const availableIds = portfolios.map((portfolio) => portfolio.id);
    const availableIdSet = new Set(availableIds);

    if (scope.mode === "all") {
        return {
            scope,
            selectedPortfolioIds: availableIds,
            missingPortfolioIds: [],
            usedFallback: false,
        };
    }

    const selectedPortfolioIds = uniqueIds(scope.selectedPortfolioIds).filter((id) => availableIdSet.has(id));
    const missingPortfolioIds = uniqueIds(scope.selectedPortfolioIds).filter((id) => !availableIdSet.has(id));
    const usedFallback = selectedPortfolioIds.length === 0 && availableIds.length > 0;

    return {
        scope: usedFallback ? DEFAULT_PORTFOLIO_SCOPE : { mode: "manual", selectedPortfolioIds },
        selectedPortfolioIds: usedFallback ? availableIds : selectedPortfolioIds,
        missingPortfolioIds,
        usedFallback,
    };
}

export function loadKnownPortfolios(): Portfolio[] {
    if (!isBrowser()) {
        return [];
    }

    try {
        const raw = window.localStorage.getItem(KNOWN_PORTFOLIOS_STORAGE_KEY);

        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw) as unknown;

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter((item): item is Portfolio => {
            return Boolean(
                item &&
                typeof item === "object" &&
                typeof (item as Portfolio).id === "string" &&
                typeof (item as Portfolio).name === "string"
            );
        });
    } catch {
        return [];
    }
}

export function saveKnownPortfolios(portfolios: Portfolio[]): void {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.setItem(KNOWN_PORTFOLIOS_STORAGE_KEY, JSON.stringify(portfolios));
    } catch {
        // localStorage-Probleme bewusst ignorieren.
    }
}

export function clearLocalAssetTraceState(): void {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.removeItem(APPEARANCE_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
        window.localStorage.removeItem(PORTFOLIO_SCOPE_STORAGE_KEY);
        window.localStorage.removeItem(KNOWN_PORTFOLIOS_STORAGE_KEY);
    } catch {
        // localStorage-Probleme bewusst ignorieren.
    }
}
