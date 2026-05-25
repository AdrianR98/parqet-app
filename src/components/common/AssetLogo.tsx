"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssetSummary } from "../../lib/types";
import { getAssetInitials, getAssetResolvedLogoUrl } from "../../lib/asset-display";
import styles from "./AssetLogo.module.css";

const FAILED_LOGO_STORAGE_KEY = "parqet-failed-logo-urls-v1";
const failedLogoUrls = new Set<string>();
let hasLoadedFailedLogoUrls = false;

function normalizeUrl(candidate: string | null): string | null {
    if (typeof candidate !== "string") {
        return null;
    }

    const value = candidate.trim();
    return value.length > 0 ? value : null;
}

function readFailedUrlsFromStorage(): string[] {
    if (typeof window === "undefined") {
        return [];
    }

    try {
        const raw = window.sessionStorage.getItem(FAILED_LOGO_STORAGE_KEY);
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
    } catch {
        return [];
    }
}

function persistFailedUrlsToStorage() {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.sessionStorage.setItem(FAILED_LOGO_STORAGE_KEY, JSON.stringify(Array.from(failedLogoUrls)));
    } catch {
        // Ignore quota / privacy mode failures.
    }
}

function primeFailedUrlCache() {
    if (hasLoadedFailedLogoUrls || typeof window === "undefined") {
        return;
    }

    hasLoadedFailedLogoUrls = true;
    for (const url of readFailedUrlsFromStorage()) {
        failedLogoUrls.add(url);
    }
}

function markFailedLogoUrl(url: string) {
    if (failedLogoUrls.has(url)) {
        return;
    }

    failedLogoUrls.add(url);
    persistFailedUrlsToStorage();
}

type AssetLogoProps = {
    asset: AssetSummary;
    displayName: string;
    className?: string;
    imageClassName?: string;
    fallbackClassName?: string;
    loading?: "eager" | "lazy";
};

export default function AssetLogo({
    asset,
    displayName,
    className,
    imageClassName,
    fallbackClassName,
    loading = "lazy",
}: AssetLogoProps) {
    const logoUrl = useMemo(() => normalizeUrl(getAssetResolvedLogoUrl(asset)), [asset]);
    const [failedUrl, setFailedUrl] = useState<string | null>(null);

    useEffect(() => {
        primeFailedUrlCache();
    }, []);

    const isKnownFailed = Boolean(logoUrl && failedLogoUrls.has(logoUrl));
    const shouldRenderFallback = !logoUrl || isKnownFailed || failedUrl === logoUrl;

    if (shouldRenderFallback) {
        return (
            <span
                className={`${styles.root} ${styles.fallback} ${fallbackClassName ?? ""} ${className ?? ""}`.trim()}
                title="Logo nicht verfügbar"
                aria-label="Logo nicht verfügbar"
            >
                {getAssetInitials(asset)}
            </span>
        );
    }

    return (
        <img
            src={logoUrl}
            alt={`${displayName} Logo`}
            className={`${styles.root} ${styles.image} ${imageClassName ?? ""} ${className ?? ""}`.trim()}
            onError={() => {
                markFailedLogoUrl(logoUrl);
                setFailedUrl(logoUrl);
            }}
            loading={loading}
            decoding="async"
        />
    );
}
