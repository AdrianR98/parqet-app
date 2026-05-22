import type { Portfolio } from "./types";

export const APPEARANCE_STORAGE_KEY = "assettrace-appearance-mode-v1";
export const LEGACY_THEME_STORAGE_KEY = "parqet-theme-v1";
export const PORTFOLIO_SCOPE_STORAGE_KEY = "assettrace-portfolio-scope-v1";
export const KNOWN_PORTFOLIOS_STORAGE_KEY = "assettrace-known-portfolios-v1";
export const REVEAL_BLOCK_SIZE_STORAGE_KEY = "assettrace-reveal-block-size-v1";
export const ASSET_TABLE_VISIBLE_COLUMNS_STORAGE_KEY = "assettrace-asset-table-visible-columns-v1";
export const ASSET_DETAIL_TIME_RANGE_STORAGE_KEY = "assettrace-asset-detail-time-range-v1";
export const LOCAL_SETTINGS_CHANGE_EVENT = "assettrace:settings-local-state-change";

export const REVEAL_BLOCK_SIZE_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_REVEAL_BLOCK_SIZE = 50;

export type AppearanceMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type RevealBlockSize = (typeof REVEAL_BLOCK_SIZE_OPTIONS)[number];
export type AssetDetailTimeRange = "1y" | "3y" | "5y" | "10y" | "max";

export type PortfolioScope = {
    mode: "all" | "manual";
    selectedPortfolioIds: string[];
};

export type PortfolioScopeResolution = {
    scope: PortfolioScope;
    selectedPortfolioIds: string[];
    missingPortfolioIds: string[];
    usedFallback: boolean;
    hasEmptyManualIntersection: boolean;
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

function haveSameIdSelection(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
        return false;
    }

    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();

    return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export function haveSamePortfolioScope(left: PortfolioScope, right: PortfolioScope): boolean {
    return left.mode === right.mode && haveSameIdSelection(left.selectedPortfolioIds, right.selectedPortfolioIds);
}

export function notifyLocalSettingsChanged(): void {
    if (isBrowser()) {
        window.dispatchEvent(new Event(LOCAL_SETTINGS_CHANGE_EVENT));
    }
}

export function subscribeToLocalSettings(onStoreChange: () => void) {
    if (!isBrowser()) {
        return () => {};
    }

    window.addEventListener("storage", onStoreChange);
    window.addEventListener(LOCAL_SETTINGS_CHANGE_EVENT, onStoreChange);

    return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener(LOCAL_SETTINGS_CHANGE_EVENT, onStoreChange);
    };
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

export function parseRevealBlockSize(value: unknown): RevealBlockSize {
    const numericValue = typeof value === "string" ? Number(value) : value;

    if (REVEAL_BLOCK_SIZE_OPTIONS.includes(numericValue as RevealBlockSize)) {
        return numericValue as RevealBlockSize;
    }

    return DEFAULT_REVEAL_BLOCK_SIZE;
}

export function loadRevealBlockSize(): RevealBlockSize {
    if (!isBrowser()) {
        return DEFAULT_REVEAL_BLOCK_SIZE;
    }

    try {
        return parseRevealBlockSize(window.localStorage.getItem(REVEAL_BLOCK_SIZE_STORAGE_KEY));
    } catch {
        return DEFAULT_REVEAL_BLOCK_SIZE;
    }
}

export function saveRevealBlockSize(size: RevealBlockSize): void {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.setItem(REVEAL_BLOCK_SIZE_STORAGE_KEY, String(parseRevealBlockSize(size)));
    } catch {
        // localStorage-Probleme bewusst ignorieren.
    }
}

function parseStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string");
}

export function loadAssetTableVisibleColumns(
    allowedColumns: string[],
    defaultColumns: string[],
    fixedColumns: string[]
): string[] {
    const allowedSet = new Set(allowedColumns);

    const fallback = Array.from(new Set(defaultColumns.filter((key) => allowedSet.has(key))));

    if (!isBrowser()) {
        return fallback;
    }

    try {
        const raw = window.localStorage.getItem(ASSET_TABLE_VISIBLE_COLUMNS_STORAGE_KEY);

        if (!raw) {
            return fallback;
        }

        const parsed = parseStringList(JSON.parse(raw) as unknown)
            .filter((key) => allowedSet.has(key));

        if (parsed.length === 0) {
            return fallback;
        }

        const next = Array.from(new Set(parsed));

        for (const key of fixedColumns) {
            if (allowedSet.has(key) && !next.includes(key)) {
                next.unshift(key);
            }
        }

        return next;
    } catch {
        return fallback;
    }
}

export function saveAssetTableVisibleColumns(columns: string[]): void {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.setItem(
            ASSET_TABLE_VISIBLE_COLUMNS_STORAGE_KEY,
            JSON.stringify(Array.from(new Set(columns.filter((key) => typeof key === "string"))))
        );
        notifyLocalSettingsChanged();
    } catch {
        // localStorage-Probleme bewusst ignorieren.
    }
}

export function parseAssetDetailTimeRange(value: unknown): AssetDetailTimeRange {
    if (value === "1y" || value === "3y" || value === "5y" || value === "10y" || value === "max") {
        return value;
    }

    return "1y";
}

export function loadAssetDetailTimeRange(): AssetDetailTimeRange {
    if (!isBrowser()) {
        return "1y";
    }

    try {
        return parseAssetDetailTimeRange(window.localStorage.getItem(ASSET_DETAIL_TIME_RANGE_STORAGE_KEY));
    } catch {
        return "1y";
    }
}

export function saveAssetDetailTimeRange(value: AssetDetailTimeRange): void {
    if (!isBrowser()) {
        return;
    }

    try {
        const nextValue = parseAssetDetailTimeRange(value);
        const currentValue = loadAssetDetailTimeRange();

        if (currentValue === nextValue) {
            return;
        }

        window.localStorage.setItem(ASSET_DETAIL_TIME_RANGE_STORAGE_KEY, nextValue);
        notifyLocalSettingsChanged();
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
        const nextScope = parsePortfolioScope(scope);
        const currentScope = loadPortfolioScope();

        if (haveSamePortfolioScope(currentScope, nextScope)) {
            return;
        }

        window.localStorage.setItem(PORTFOLIO_SCOPE_STORAGE_KEY, JSON.stringify(nextScope));
        notifyLocalSettingsChanged();
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
            hasEmptyManualIntersection: false,
        };
    }

    const selectedPortfolioIds = uniqueIds(scope.selectedPortfolioIds).filter((id) => availableIdSet.has(id));
    const missingPortfolioIds = uniqueIds(scope.selectedPortfolioIds).filter((id) => !availableIdSet.has(id));
    const hasEmptyManualIntersection =
        uniqueIds(scope.selectedPortfolioIds).length > 0 &&
        selectedPortfolioIds.length === 0;

    return {
        scope: { mode: "manual", selectedPortfolioIds },
        selectedPortfolioIds,
        missingPortfolioIds,
        usedFallback: false,
        hasEmptyManualIntersection,
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
        const normalized = portfolios
            .filter((portfolio) => (
                typeof portfolio?.id === "string" &&
                typeof portfolio?.name === "string"
            ))
            .map((portfolio) => ({
                id: portfolio.id,
                name: portfolio.name,
                currency: portfolio.currency,
                createdAt: portfolio.createdAt,
                distinctBrokers: Array.isArray(portfolio.distinctBrokers)
                    ? portfolio.distinctBrokers
                    : [],
            }));
        const nextRaw = JSON.stringify(normalized);
        const currentRaw = window.localStorage.getItem(KNOWN_PORTFOLIOS_STORAGE_KEY);

        if (currentRaw === nextRaw) {
            return;
        }

        window.localStorage.setItem(KNOWN_PORTFOLIOS_STORAGE_KEY, nextRaw);
        notifyLocalSettingsChanged();
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
        window.localStorage.removeItem(REVEAL_BLOCK_SIZE_STORAGE_KEY);
        window.localStorage.removeItem(ASSET_TABLE_VISIBLE_COLUMNS_STORAGE_KEY);
        window.localStorage.removeItem(ASSET_DETAIL_TIME_RANGE_STORAGE_KEY);
    } catch {
        // localStorage-Probleme bewusst ignorieren.
    }
}
