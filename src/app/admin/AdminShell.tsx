"use client";

import { useEffect, useMemo, useState } from "react";
import { Refine, useCan, useIsAuthenticated } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { adminAccessControlProvider, adminAuthProvider } from "@/lib/admin/refine";
import styles from "./page.module.css";

const PLACEHOLDER_RESOURCES = ["Market Data Status"] as const;

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

type UnmappedMarketDataPayload = {
    totalOpen: number;
    shown: number;
    limit: number;
    filters: {
        category: string | null;
        action: string | null;
        status: string | null;
    };
    items: Array<{
        priority: number;
        isin: string;
        displayName: string | null;
        assetType: string | null;
        currency: string | null;
        wkn: string | null;
        marketDataStatus: string | null;
        mappingStatus: string;
        primarySymbol: string | null;
        candidateSymbols: string[];
        category: string;
        suggestedAction: string;
        statusReason: string | null;
        hasPriceData: boolean;
        hasMarketActions: boolean;
    }>;
};

type MarketInstrumentsPayload = {
    total: number;
    shown: number;
    limit: number;
    filters: {
        q: string | null;
        status: string | null;
        assetType: string | null;
        hasPrimary: boolean | null;
        hasPrices: boolean | null;
    };
    items: Array<{
        isin: string;
        displayName: string | null;
        name: string | null;
        assetType: string | null;
        currency: string | null;
        wkn: string | null;
        metadataStatus: string | null;
        marketDataStatus: string | null;
        marketDataStatusReason: string | null;
        primarySymbol: string | null;
        primaryExchange: string | null;
        primaryCurrency: string | null;
        verifiedMappingCount: number;
        candidateMappingCount: number;
        hasPriceData: boolean;
        hasMarketActions: boolean;
        firstPriceDate: string | null;
        lastPriceDate: string | null;
        latestClose: number | null;
    }>;
};

type MarketMappingsPayload = {
    total: number;
    shown: number;
    limit: number;
    filters: {
        q: string | null;
        provider: string | null;
        verified: boolean | null;
        primary: boolean | null;
        active: boolean | null;
        hasPrices: boolean | null;
    };
    items: Array<{
        id: string;
        isin: string;
        displayName: string | null;
        provider: string;
        symbol: string;
        exchange: string | null;
        currency: string | null;
        score: number | null;
        isPrimary: boolean;
        isActive: boolean;
        verifiedAt: string | null;
        source: string | null;
        statusReason: string | null;
        hasPriceData: boolean;
        latestPriceDate: string | null;
        latestClose: number | null;
    }>;
};

type MarketRunsPayload = {
    total: number;
    shown: number;
    limit: number;
    filters: {
        status: string | null;
        runType: string | null;
        provider: string | null;
    };
    items: Array<{
        id: string;
        runType: string;
        status: string;
        provider: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        durationMs: number | null;
        requestedBy: string | null;
        totalItems: number;
        succeededItems: number;
        failedItems: number;
        skippedItems: number;
        errorCount: number;
        latestErrorMessage: string | null;
    }>;
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
    const [unmappedData, setUnmappedData] = useState<UnmappedMarketDataPayload | null>(null);
    const [unmappedError, setUnmappedError] = useState<string | null>(null);
    const [instrumentsData, setInstrumentsData] = useState<MarketInstrumentsPayload | null>(null);
    const [instrumentsError, setInstrumentsError] = useState<string | null>(null);
    const [mappingsData, setMappingsData] = useState<MarketMappingsPayload | null>(null);
    const [mappingsError, setMappingsError] = useState<string | null>(null);
    const [runsData, setRunsData] = useState<MarketRunsPayload | null>(null);
    const [runsError, setRunsError] = useState<string | null>(null);

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

    useEffect(() => {
        if (sessionState !== "enabled") return;

        const controller = new AbortController();

        fetch("/api/admin/market-data/runs?limit=25", {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("runs-fetch-failed");
                }
                return (await response.json()) as MarketRunsPayload;
            })
            .then((payload) => {
                setRunsData(payload);
                setRunsError(null);
            })
            .catch((error: unknown) => {
                if (error instanceof Error && error.name === "AbortError") return;
                setRunsData(null);
                setRunsError("Market data runs overview is currently unavailable.");
            });

        return () => controller.abort();
    }, [sessionState]);

    useEffect(() => {
        if (sessionState !== "enabled") return;

        const controller = new AbortController();

        fetch("/api/admin/market-data/mappings?limit=50", {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("mappings-fetch-failed");
                }
                return (await response.json()) as MarketMappingsPayload;
            })
            .then((payload) => {
                setMappingsData(payload);
                setMappingsError(null);
            })
            .catch((error: unknown) => {
                if (error instanceof Error && error.name === "AbortError") return;
                setMappingsData(null);
                setMappingsError("Market symbol mappings overview is currently unavailable.");
            });

        return () => controller.abort();
    }, [sessionState]);

    useEffect(() => {
        if (sessionState !== "enabled") return;

        const controller = new AbortController();

        fetch("/api/admin/market-data/instruments?limit=50", {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("instruments-fetch-failed");
                }
                return (await response.json()) as MarketInstrumentsPayload;
            })
            .then((payload) => {
                setInstrumentsData(payload);
                setInstrumentsError(null);
            })
            .catch((error: unknown) => {
                if (error instanceof Error && error.name === "AbortError") return;
                setInstrumentsData(null);
                setInstrumentsError("Market instruments overview is currently unavailable.");
            });

        return () => controller.abort();
    }, [sessionState]);

    useEffect(() => {
        if (sessionState !== "enabled") return;

        const controller = new AbortController();

        fetch("/api/admin/market-data/unmapped?limit=50", {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("unmapped-fetch-failed");
                }
                return (await response.json()) as UnmappedMarketDataPayload;
            })
            .then((payload) => {
                setUnmappedData(payload);
                setUnmappedError(null);
            })
            .catch((error: unknown) => {
                if (error instanceof Error && error.name === "AbortError") return;
                setUnmappedData(null);
                setUnmappedError("Open/unmapped market-data assets are currently unavailable.");
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

            <section className={styles.surface}>
                <h2>Unmapped / Open Market Data Assets</h2>
                <p className={styles.note}>
                    Read-only view. Changes still happen through the CLI/admin workflow.
                </p>
                {sessionState !== "enabled" ? (
                    <p className={styles.subtle}>List is unavailable while admin is disabled or unauthorized.</p>
                ) : !unmappedData && !unmappedError ? (
                    <p className={styles.subtle}>Loading unmapped/open assets...</p>
                ) : unmappedError ? (
                    <p className={styles.errorText}>{unmappedError}</p>
                ) : unmappedData && unmappedData.items.length === 0 ? (
                    <>
                        <p className={styles.subtle}>
                            Showing {unmappedData.shown.toLocaleString()} of {unmappedData.totalOpen.toLocaleString()} open cases.
                        </p>
                        <p className={styles.subtle}>No open/unmapped market-data assets for the current filter.</p>
                    </>
                ) : unmappedData ? (
                    <>
                        <p className={styles.subtle}>
                            Showing {unmappedData.shown.toLocaleString()} of {unmappedData.totalOpen.toLocaleString()} open cases.
                        </p>
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Prio</th>
                                        <th>ISIN</th>
                                        <th>Name</th>
                                        <th>Category</th>
                                        <th>Action</th>
                                        <th>Status</th>
                                        <th>Primary</th>
                                        <th>Candidates</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {unmappedData.items.map((item) => (
                                        <tr key={item.isin}>
                                            <td>{item.priority}</td>
                                            <td>{item.isin}</td>
                                            <td>{item.displayName ?? "—"}</td>
                                            <td>{item.category}</td>
                                            <td>{item.suggestedAction}</td>
                                            <td>{item.mappingStatus}</td>
                                            <td>{item.primarySymbol ?? "—"}</td>
                                            <td>{item.candidateSymbols.length ? item.candidateSymbols.join(", ") : "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <p className={styles.subtle}>No unmapped/open data available.</p>
                )}
            </section>

            <section className={styles.surface}>
                <h2>Market Instruments</h2>
                <p className={styles.note}>Read-only instrument/mapping/price status overview.</p>
                {sessionState !== "enabled" ? (
                    <p className={styles.subtle}>List is unavailable while admin is disabled or unauthorized.</p>
                ) : !instrumentsData && !instrumentsError ? (
                    <p className={styles.subtle}>Loading market instruments...</p>
                ) : instrumentsError ? (
                    <p className={styles.errorText}>{instrumentsError}</p>
                ) : instrumentsData && instrumentsData.items.length === 0 ? (
                    <>
                        <p className={styles.subtle}>
                            Showing {instrumentsData.shown.toLocaleString()} of {instrumentsData.total.toLocaleString()} instruments.
                        </p>
                        <p className={styles.subtle}>No market instruments for the current filter.</p>
                    </>
                ) : instrumentsData ? (
                    <>
                        <p className={styles.subtle}>
                            Showing {instrumentsData.shown.toLocaleString()} of {instrumentsData.total.toLocaleString()} instruments.
                        </p>
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>ISIN</th>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                        <th>Primary</th>
                                        <th>Verified</th>
                                        <th>Candidates</th>
                                        <th>Prices</th>
                                        <th>Last price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {instrumentsData.items.map((item) => (
                                        <tr key={item.isin}>
                                            <td>{item.isin}</td>
                                            <td>{item.displayName ?? item.name ?? "—"}</td>
                                            <td>{item.assetType ?? "—"}</td>
                                            <td>{item.marketDataStatus ?? "unset"}</td>
                                            <td>{item.primarySymbol ?? "—"}</td>
                                            <td>{item.verifiedMappingCount}</td>
                                            <td>{item.candidateMappingCount}</td>
                                            <td>{item.hasPriceData ? "yes" : "no"}</td>
                                            <td>{item.lastPriceDate ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <p className={styles.subtle}>No instrument data available.</p>
                )}
            </section>

            <section className={styles.surface}>
                <h2>Market Symbol Mappings</h2>
                <p className={styles.note}>Read-only mapping and latest price status overview.</p>
                {sessionState !== "enabled" ? (
                    <p className={styles.subtle}>List is unavailable while admin is disabled or unauthorized.</p>
                ) : !mappingsData && !mappingsError ? (
                    <p className={styles.subtle}>Loading market symbol mappings...</p>
                ) : mappingsError ? (
                    <p className={styles.errorText}>{mappingsError}</p>
                ) : mappingsData && mappingsData.items.length === 0 ? (
                    <>
                        <p className={styles.subtle}>
                            Showing {mappingsData.shown.toLocaleString()} of {mappingsData.total.toLocaleString()} mappings.
                        </p>
                        <p className={styles.subtle}>No market symbol mappings for the current filter.</p>
                    </>
                ) : mappingsData ? (
                    <>
                        <p className={styles.subtle}>
                            Showing {mappingsData.shown.toLocaleString()} of {mappingsData.total.toLocaleString()} mappings.
                        </p>
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>ISIN</th>
                                        <th>Provider</th>
                                        <th>Symbol</th>
                                        <th>Primary</th>
                                        <th>Active</th>
                                        <th>Verified</th>
                                        <th>Has prices</th>
                                        <th>Latest price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mappingsData.items.map((item) => (
                                        <tr key={item.id}>
                                            <td>{item.isin}</td>
                                            <td>{item.provider}</td>
                                            <td>{item.symbol}</td>
                                            <td>{item.isPrimary ? "yes" : "no"}</td>
                                            <td>{item.isActive ? "yes" : "no"}</td>
                                            <td>{item.verifiedAt ? "yes" : "no"}</td>
                                            <td>{item.hasPriceData ? "yes" : "no"}</td>
                                            <td>{item.latestPriceDate ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <p className={styles.subtle}>No mapping data available.</p>
                )}
            </section>

            <section className={styles.surface}>
                <h2>Market Data Runs</h2>
                <p className={styles.note}>Read-only run metadata. Run actions remain CLI/admin-workflow only.</p>
                {sessionState !== "enabled" ? (
                    <p className={styles.subtle}>List is unavailable while admin is disabled or unauthorized.</p>
                ) : !runsData && !runsError ? (
                    <p className={styles.subtle}>Loading market data runs...</p>
                ) : runsError ? (
                    <p className={styles.errorText}>{runsError}</p>
                ) : runsData && runsData.items.length === 0 ? (
                    <>
                        <p className={styles.subtle}>
                            Showing {runsData.shown.toLocaleString()} of {runsData.total.toLocaleString()} runs.
                        </p>
                        <p className={styles.subtle}>No market data runs for the current filter.</p>
                    </>
                ) : runsData ? (
                    <>
                        <p className={styles.subtle}>
                            Showing {runsData.shown.toLocaleString()} of {runsData.total.toLocaleString()} runs.
                        </p>
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Run type</th>
                                        <th>Status</th>
                                        <th>Provider</th>
                                        <th>Started</th>
                                        <th>Finished</th>
                                        <th>Items</th>
                                        <th>Success</th>
                                        <th>Failed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {runsData.items.map((item) => (
                                        <tr key={item.id}>
                                            <td>{item.runType}</td>
                                            <td>{item.status}</td>
                                            <td>{item.provider ?? "—"}</td>
                                            <td>{item.startedAt ?? "—"}</td>
                                            <td>{item.finishedAt ?? "—"}</td>
                                            <td>{item.totalItems}</td>
                                            <td>{item.succeededItems}</td>
                                            <td>{item.failedItems}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <p className={styles.subtle}>No runs data available.</p>
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
