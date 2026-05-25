"use client";

import { useEffect, useMemo, useState } from "react";
import { Refine, useCan, useIsAuthenticated } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { adminAccessControlProvider, adminAuthProvider } from "@/lib/admin/refine";
import styles from "./page.module.css";

const PLACEHOLDER_RESOURCES = [
    "Market Data Status",
    "Instruments",
    "Mappings",
    "Unmapped Assets",
    "Runs",
] as const;

type MarketDataStatusPayload = {
    instrumentsTotal: number;
    mappingsTotal: number;
    yfinanceMappingsTotal: number;
    verifiedYfinanceMappings: number;
    primaryYfinanceMappings: number;
    instrumentsWithVerifiedYfinanceMapping: number;
    instrumentsWithoutAnyMapping: number;
    instrumentsWithMappingButNoVerifiedMapping: number;
    instrumentsWithoutPrimaryMapping: number;
    instrumentsWithDailyPriceData: number;
    instrumentsWithMarketActions: number;
    instrumentsWithPrimaryMappingButNoPriceData: number;
    failedValidationCandidates: number;
    marketDataStatusCounts: Record<string, number>;
    referenceSourceCounts: Array<{ sourceKey: string; rowCount: number }>;
};

function SessionBadge({ state }: { state: "enabled" | "disabled" | "loading" }) {
    if (state === "loading") {
        return <span className={`${styles.badge} ${styles.badgeMuted}`}>Checking session</span>;
    }

    if (state === "enabled") {
        return <span className={`${styles.badge} ${styles.badgeSuccess}`}>Enabled (read-only)</span>;
    }

    return <span className={`${styles.badge} ${styles.badgeWarning}`}>Disabled / Unauthorized</span>;
}

function AdminPanel() {
    const auth = useIsAuthenticated();
    const listAccess = useCan({ resource: "admin", action: "list" });
    const createAccess = useCan({ resource: "admin", action: "create" });

    const sessionState = auth.isLoading
        ? "loading"
        : auth.data?.authenticated
          ? "enabled"
          : "disabled";
    const [statusData, setStatusData] = useState<MarketDataStatusPayload | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);

    useEffect(() => {
        if (sessionState !== "enabled") return;

        const controller = new AbortController();

        fetch("/api/admin/market-data/status", {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("status-fetch-failed");
                }
                return (await response.json()) as MarketDataStatusPayload;
            })
            .then((payload) => {
                setStatusData(payload);
                setStatusError(null);
            })
            .catch((error: unknown) => {
                if (error instanceof Error && error.name === "AbortError") return;
                setStatusData(null);
                setStatusError("Market data status is currently unavailable.");
            });

        return () => controller.abort();
    }, [sessionState]);

    const kpis = useMemo(() => {
        if (!statusData) return [];
        return [
            { label: "Instruments total", value: statusData.instrumentsTotal },
            { label: "Mappings total", value: statusData.mappingsTotal },
            { label: "YFinance mappings", value: statusData.yfinanceMappingsTotal },
            { label: "Verified mappings", value: statusData.verifiedYfinanceMappings },
            { label: "Primary mappings", value: statusData.primaryYfinanceMappings },
            { label: "With verified mapping", value: statusData.instrumentsWithVerifiedYfinanceMapping },
            { label: "Without any mapping", value: statusData.instrumentsWithoutAnyMapping },
            { label: "Without primary mapping", value: statusData.instrumentsWithoutPrimaryMapping },
            { label: "With price data", value: statusData.instrumentsWithDailyPriceData },
            { label: "With market actions", value: statusData.instrumentsWithMarketActions },
            { label: "Primary but no prices", value: statusData.instrumentsWithPrimaryMappingButNoPriceData },
            { label: "Failed validation candidates", value: statusData.failedValidationCandidates },
        ];
    }, [statusData]);

    return (
        <main className={styles.root}>
            <section className={`${styles.surface} ${styles.header}`}>
                <p className={styles.eyebrow}>Admin Console</p>
                <h1>Read-only Admin</h1>
                <div className={styles.statusRow}>
                    <span>Current admin session status</span>
                    <SessionBadge state={sessionState} />
                </div>
                <p className={styles.note}>
                    This shell is read-only. No writes, no provider calls, and no production admin auth are enabled.
                </p>
            </section>

            <section className={`${styles.surface} ${styles.guard}`}>
                <h2>Guard summary</h2>
                <p>
                    Session check uses <code>/api/admin/session</code>. Mutation actions are blocked by access control.
                </p>
                <ul>
                    <li>List access: {listAccess.data?.can ? "allowed" : "denied"}</li>
                    <li>Create access: {createAccess.data?.can ? "allowed" : "denied"}</li>
                </ul>
            </section>

            <section className={styles.surface}>
                <h2>Market Data Status</h2>
                <p className={styles.note}>Read-only DB summary. No writes, provider calls, or job triggers are available.</p>
                {sessionState !== "enabled" ? (
                    <p className={styles.subtle}>Status is unavailable while admin is disabled or unauthorized.</p>
                ) : !statusData && !statusError ? (
                    <p className={styles.subtle}>Loading market data status...</p>
                ) : statusError ? (
                    <p className={styles.errorText}>{statusError}</p>
                ) : statusData ? (
                    <>
                        <section className={styles.kpiGrid}>
                            {kpis.map((item) => (
                                <article className={styles.kpiCard} key={item.label}>
                                    <p>{item.label}</p>
                                    <strong>{item.value.toLocaleString()}</strong>
                                </article>
                            ))}
                        </section>
                        <section className={styles.breakdownGrid}>
                            <article className={styles.card}>
                                <h3>Market data status counts</h3>
                                <ul className={styles.cleanList}>
                                    {Object.entries(statusData.marketDataStatusCounts).map(([status, count]) => (
                                        <li key={status}>
                                            <span>{status}</span>
                                            <strong>{count.toLocaleString()}</strong>
                                        </li>
                                    ))}
                                </ul>
                            </article>
                            <article className={styles.card}>
                                <h3>Reference source counts</h3>
                                {statusData.referenceSourceCounts.length === 0 ? (
                                    <p className={styles.subtle}>No reference rows available.</p>
                                ) : (
                                    <ul className={styles.cleanList}>
                                        {statusData.referenceSourceCounts.map((item) => (
                                            <li key={item.sourceKey}>
                                                <span>{item.sourceKey}</span>
                                                <strong>{item.rowCount.toLocaleString()}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </article>
                        </section>
                    </>
                ) : (
                    <p className={styles.subtle}>No status data available.</p>
                )}
            </section>

            <section className={styles.grid}>
                {PLACEHOLDER_RESOURCES.map((name) => (
                    <article className={styles.card} key={name}>
                        <h3>{name}</h3>
                        <p>Placeholder only. Resource wiring is intentionally deferred.</p>
                    </article>
                ))}
            </section>
        </main>
    );
}

export default function AdminShell() {
    return (
        <Refine
            authProvider={adminAuthProvider}
            accessControlProvider={adminAccessControlProvider}
            routerProvider={routerProvider}
            resources={[]}
        >
            <AdminPanel />
        </Refine>
    );
}
