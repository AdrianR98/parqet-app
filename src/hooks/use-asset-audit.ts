"use client";

import { useState } from "react";
import type { ActivitiesAuditApiResponse } from "../lib/types";

type LoadAuditInput = {
    isin: string;
    portfolioIds: string[];
};

type UseAssetAuditResult = {
    data: ActivitiesAuditApiResponse | null;
    loading: boolean;
    error: string | null;
    authRequired: boolean;
    reconnectUrl: string;
    loadAudit: (input: LoadAuditInput) => Promise<void>;
    resetAudit: () => void;
    startReconnect: () => void;
};

export function useAssetAudit(): UseAssetAuditResult {
    const [data, setData] = useState<ActivitiesAuditApiResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authRequired, setAuthRequired] = useState(false);
    const [reconnectUrl, setReconnectUrl] = useState("/api/auth/start");

    function startReconnect() {
        window.location.href = reconnectUrl || "/api/auth/start";
    }

    function resetAudit() {
        setData(null);
        setError(null);
        setAuthRequired(false);
        setReconnectUrl("/api/auth/start");
    }

    async function loadAudit(input: LoadAuditInput) {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            params.set("isin", input.isin);

            for (const portfolioId of input.portfolioIds) {
                params.append("portfolioId", portfolioId);
            }

            const response = await fetch(`/api/parqet/assets/audit?${params.toString()}`);
            const json = (await response.json()) as ActivitiesAuditApiResponse;

            if (!response.ok || !json.ok) {
                if (json.authRequired) {
                    setAuthRequired(true);
                    setReconnectUrl(json.reconnectUrl || "/api/auth/start");
                    setError(
                        json.message ||
                        "Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden."
                    );
                    setData(null);
                    return;
                }

                throw new Error(
                    [json.message, json.details].filter(Boolean).join(" — ") ||
                    "Audit-Daten konnten nicht geladen werden."
                );
            }

            setData(json);
            setAuthRequired(false);
            setReconnectUrl("/api/auth/start");
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
                    : "Audit-Daten konnten nicht geladen werden."
            );
            setData(null);
        } finally {
            setLoading(false);
        }
    }

    return {
        data,
        loading,
        error,
        authRequired,
        reconnectUrl,
        loadAudit,
        resetAudit,
        startReconnect,
    };
}