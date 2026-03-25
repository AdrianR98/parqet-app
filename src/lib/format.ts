// src/lib/format.ts

export function formatCurrency(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
        return "—";
    }

    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatNumber(
    value: number | null | undefined,
    digits = 2
): string {
    if (value == null || Number.isNaN(value)) {
        return "—";
    }

    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(value);
}

export function formatShares(value: number | null | undefined): string {
    return formatNumber(value, 4);
}

export function getPnLClass(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
        return "";
    }

    if (value > 0) return "positive";
    if (value < 0) return "negative";
    return "";
}