// ============================================================
// src/hooks/use-asset-audit.ts
// ------------------------------------------------------------
// Hook zum Laden der Audit-Daten fuer ein einzelnes Asset.
// ============================================================

"use client";

import { useCallback, useState } from "react";
import type { ActivitiesAuditApiResponse } from "../lib/types";

type LoadParams = {
    isin: string;
    portfolioIds: string[];
};

export function useAssetAudit() {
    const [data, setData] = useState<ActivitiesAuditApiResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadAudit = useCallback(async ({ isin, portfolioIds }: LoadParams) => {
        if (!isin || portfolioIds.length === 0) {
            setData(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();

            for (const portfolioId of portfolioIds) {
                params.append("portfolioId", portfolioId);
            }

            params.set("isin", isin);

            const response = await fetch(`/api/parqet/assets/audit?${params.toString()}`, {
                cache: "no-store",
            });

            const json = (await response.json()) as ActivitiesAuditApiResponse;

            if (!response.ok || !json.ok) {
                throw new Error(json.message || "Failed to load asset audit.");
            }

            setData(json);
        } catch (err) {
            setData(null);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    const resetAudit = useCallback(() => {
        setData(null);
        setError(null);
        setLoading(false);
    }, []);

    return {
        data,
        loading,
        error,
        loadAudit,
        resetAudit,
    };
}