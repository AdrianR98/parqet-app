// src/lib/format.ts

const GERMAN_LOCALE = "de-DE";
const DEFAULT_FALLBACK = "—";

function isFiniteNumber(value: number | null | undefined): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export function formatCurrency(
    value: number | null | undefined,
    options: { currency?: string; fallback?: string } = {}
): string {
    if (!isFiniteNumber(value)) {
        return options.fallback ?? DEFAULT_FALLBACK;
    }

    return new Intl.NumberFormat(GERMAN_LOCALE, {
        style: "currency",
        currency: options.currency ?? "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatNumber(
    value: number | null | undefined,
    digits = 2,
    fallback = DEFAULT_FALLBACK
): string {
    if (!isFiniteNumber(value)) {
        return fallback;
    }

    return new Intl.NumberFormat(GERMAN_LOCALE, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

export function formatQuantity(
    value: number | null | undefined,
    options: { minimumFractionDigits?: number; maximumFractionDigits?: number; fallback?: string } = {}
): string {
    if (!isFiniteNumber(value)) {
        return options.fallback ?? DEFAULT_FALLBACK;
    }

    return new Intl.NumberFormat(GERMAN_LOCALE, {
        minimumFractionDigits: options.minimumFractionDigits ?? 0,
        maximumFractionDigits: options.maximumFractionDigits ?? 2,
    }).format(value);
}

export function formatShares(value: number | null | undefined): string {
    return formatQuantity(value, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    });
}

export function formatPercent(
    value: number | null | undefined,
    options: { digits?: number; fallback?: string; alreadyPercent?: boolean } = {}
): string {
    if (!isFiniteNumber(value)) {
        return options.fallback ?? DEFAULT_FALLBACK;
    }

    const normalizedValue = options.alreadyPercent ? value / 100 : value;

    return new Intl.NumberFormat(GERMAN_LOCALE, {
        style: "percent",
        minimumFractionDigits: options.digits ?? 2,
        maximumFractionDigits: options.digits ?? 2,
    }).format(normalizedValue);
}

export function formatDate(
    value: string | Date | null | undefined,
    fallback = DEFAULT_FALLBACK
): string {
    if (!value) return fallback;

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return new Intl.DateTimeFormat(GERMAN_LOCALE, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

export function formatDateTime(
    value: string | Date | null | undefined,
    fallback = DEFAULT_FALLBACK
): string {
    if (!value) return fallback;

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return new Intl.DateTimeFormat(GERMAN_LOCALE, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

export function formatMonth(
    value: string | Date | null | undefined,
    fallback = DEFAULT_FALLBACK
): string {
    if (!value) return fallback;

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return new Intl.DateTimeFormat(GERMAN_LOCALE, {
        month: "long",
        year: "numeric",
    }).format(date);
}

export function formatAvailability(value: string | null | undefined): string {
    return value && value.trim().length > 0 ? value : "nicht verfügbar";
}

export function getPnLClass(value: number | null | undefined): string {
    if (!isFiniteNumber(value)) {
        return "";
    }

    if (value > 0) return "positive";
    if (value < 0) return "negative";
    return "";
}
