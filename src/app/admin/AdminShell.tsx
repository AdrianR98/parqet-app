"use client";

import { useEffect, useMemo, useState } from "react";
import { Refine, useCan, useIsAuthenticated } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { adminAccessControlProvider, adminAuthProvider } from "@/lib/admin/refine";
import styles from "./page.module.css";

type SortDirection = "asc" | "desc";
type SortState = { key: string; direction: SortDirection };
type SectionState = { status: boolean; unmapped: boolean; instruments: boolean; mappings: boolean; runs: boolean };
type AnyRow = Record<string, unknown>;

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

type UnmappedRow = {
    priority: number;
    isin: string;
    displayName: string | null;
    wkn: string | null;
    marketDataStatus: string | null;
    mappingStatus: string;
    primarySymbol: string | null;
    category: string;
    suggestedAction: string;
};

type InstrumentRow = {
    isin: string;
    displayName: string | null;
    name: string | null;
    assetType: string | null;
    wkn: string | null;
    marketDataStatus: string | null;
    primarySymbol: string | null;
    verifiedMappingCount: number;
    candidateMappingCount: number;
    hasPriceData: boolean;
    lastPriceDate: string | null;
};

type MappingRow = {
    id: string;
    isin: string;
    displayName: string | null;
    provider: string;
    symbol: string;
    exchange: string | null;
    isPrimary: boolean;
    isActive: boolean;
    verifiedAt: string | null;
    hasPriceData: boolean;
    latestPriceDate: string | null;
    statusReason: string | null;
};

type RunsRow = {
    id: string;
    runType: string;
    status: string;
    provider: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    totalItems: number;
    succeededItems: number;
    failedItems: number;
    latestErrorMessage: string | null;
};

function SessionBadge({ state }: { state: "enabled" | "disabled" | "loading" }) {
    if (state === "loading") return <span className={`${styles.badge} ${styles.badgeMuted}`}>Checking session</span>;
    if (state === "enabled") return <span className={`${styles.badge} ${styles.badgeSuccess}`}>Enabled (read-only)</span>;
    return <span className={`${styles.badge} ${styles.badgeWarning}`}>Disabled / Unauthorized</span>;
}

function normalize(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).toLowerCase();
}

function compareValues(a: unknown, b: unknown): number {
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
    return normalize(a).localeCompare(normalize(b));
}

function sortRows<T extends AnyRow>(rows: T[], sort: SortState): T[] {
    return [...rows].sort((a, b) => {
        const next = compareValues(a[sort.key], b[sort.key]);
        return sort.direction === "asc" ? next : -next;
    });
}

function matchesSearch(search: string, values: unknown[]): boolean {
    if (!search) return true;
    return values.some((value) => normalize(value).includes(search));
}

function SortableHeader({
    label,
    column,
    sort,
    onToggle,
}: {
    label: string;
    column: string;
    sort: SortState;
    onToggle: (column: string) => void;
}) {
    const marker = sort.key === column ? (sort.direction === "asc" ? "▲" : "▼") : "↕";
    return (
        <button type="button" className={styles.sortButton} onClick={() => onToggle(column)}>
            {label} <span>{marker}</span>
        </button>
    );
}

function Section({
    title,
    summary,
    open,
    onToggle,
    children,
}: {
    title: string;
    summary: string;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <section className={styles.sectionSurface}>
            <button type="button" className={styles.sectionHeader} onClick={onToggle}>
                <span>{title}</span>
                <span className={styles.sectionMeta}>
                    {summary} {open ? "▾" : "▸"}
                </span>
            </button>
            {open ? <div className={styles.sectionBody}>{children}</div> : null}
        </section>
    );
}

export default function AdminShell() {
    return (
        <Refine authProvider={adminAuthProvider} accessControlProvider={adminAccessControlProvider} routerProvider={routerProvider} resources={[]}>
            <AdminPanel />
        </Refine>
    );
}

function AdminPanel() {
    const auth = useIsAuthenticated();
    const listAccess = useCan({ resource: "admin", action: "list" });
    const createAccess = useCan({ resource: "admin", action: "create" });
    const sessionState = auth.isLoading ? "loading" : auth.data?.authenticated ? "enabled" : "disabled";

    const [statusData, setStatusData] = useState<MarketDataStatusPayload | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [unmappedData, setUnmappedData] = useState<{ totalOpen: number; items: UnmappedRow[] } | null>(null);
    const [unmappedError, setUnmappedError] = useState<string | null>(null);
    const [instrumentsData, setInstrumentsData] = useState<{ total: number; items: InstrumentRow[] } | null>(null);
    const [instrumentsError, setInstrumentsError] = useState<string | null>(null);
    const [mappingsData, setMappingsData] = useState<{ total: number; items: MappingRow[] } | null>(null);
    const [mappingsError, setMappingsError] = useState<string | null>(null);
    const [runsData, setRunsData] = useState<{ total: number; items: RunsRow[] } | null>(null);
    const [runsError, setRunsError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const searchTerm = search.trim().toLowerCase();
    const [open, setOpen] = useState<SectionState>({ status: true, unmapped: true, instruments: false, mappings: false, runs: false });

    const [unmappedSort, setUnmappedSort] = useState<SortState>({ key: "priority", direction: "desc" });
    const [instrumentsSort, setInstrumentsSort] = useState<SortState>({ key: "isin", direction: "asc" });
    const [mappingsSort, setMappingsSort] = useState<SortState>({ key: "isin", direction: "asc" });
    const [runsSort, setRunsSort] = useState<SortState>({ key: "startedAt", direction: "desc" });

    function toggleSort(sort: SortState, setSort: (sort: SortState) => void, key: string) {
        if (sort.key === key) setSort({ key, direction: sort.direction === "asc" ? "desc" : "asc" });
        else setSort({ key, direction: "asc" });
    }

    useEffect(() => {
        if (sessionState !== "enabled") return;
        const controller = new AbortController();
        const load = async () => {
            const endpoints = [
                ["/api/admin/market-data/status", setStatusData, setStatusError, "Market data status is currently unavailable."],
                ["/api/admin/market-data/unmapped?limit=50", setUnmappedData, setUnmappedError, "Open/unmapped market-data assets are currently unavailable."],
                ["/api/admin/market-data/instruments?limit=50", setInstrumentsData, setInstrumentsError, "Market instruments overview is currently unavailable."],
                ["/api/admin/market-data/mappings?limit=50", setMappingsData, setMappingsError, "Market symbol mappings overview is currently unavailable."],
                ["/api/admin/market-data/runs?limit=25", setRunsData, setRunsError, "Market data runs overview is currently unavailable."],
            ] as const;
            await Promise.all(
                endpoints.map(async ([url, setData, setError, message]) => {
                    try {
                        const response = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
                        if (!response.ok) throw new Error("fetch-failed");
                        setData(await response.json());
                        setError(null);
                    } catch (error: unknown) {
                        if (error instanceof Error && error.name === "AbortError") return;
                        setData(null);
                        setError(message);
                    }
                }),
            );
        };
        void load();
        return () => controller.abort();
    }, [sessionState]);

    const unmappedRows = useMemo(
        () =>
            sortRows(
                (unmappedData?.items ?? []).filter((row) =>
                    matchesSearch(searchTerm, [
                        row.isin,
                        row.wkn,
                        row.displayName,
                        row.primarySymbol,
                        row.marketDataStatus,
                        row.mappingStatus,
                        row.category,
                        row.suggestedAction,
                    ]),
                ),
                unmappedSort,
            ),
        [unmappedData, searchTerm, unmappedSort],
    );

    const instrumentsRows = useMemo(
        () =>
            sortRows(
                (instrumentsData?.items ?? []).filter((row) =>
                    matchesSearch(searchTerm, [row.isin, row.wkn, row.displayName, row.name, row.primarySymbol, row.assetType, row.marketDataStatus]),
                ),
                instrumentsSort,
            ),
        [instrumentsData, searchTerm, instrumentsSort],
    );

    const mappingsRows = useMemo(
        () =>
            sortRows(
                (mappingsData?.items ?? []).filter((row) =>
                    matchesSearch(searchTerm, [row.isin, row.displayName, row.provider, row.symbol, row.exchange, row.statusReason]),
                ),
                mappingsSort,
            ),
        [mappingsData, searchTerm, mappingsSort],
    );

    const runsRows = useMemo(
        () =>
            sortRows(
                (runsData?.items ?? []).filter((row) =>
                    matchesSearch(searchTerm, [row.runType, row.status, row.provider, row.latestErrorMessage]),
                ),
                runsSort,
            ),
        [runsData, searchTerm, runsSort],
    );

    useEffect(() => {
        if (!searchTerm) return;
        setOpen((prev) => ({
            ...prev,
            unmapped: unmappedRows.length > 0 || prev.unmapped,
            instruments: instrumentsRows.length > 0 || prev.instruments,
            mappings: mappingsRows.length > 0 || prev.mappings,
            runs: runsRows.length > 0 || prev.runs,
        }));
    }, [searchTerm, unmappedRows.length, instrumentsRows.length, mappingsRows.length, runsRows.length]);

    const matchCount = unmappedRows.length + instrumentsRows.length + mappingsRows.length + runsRows.length;

    return (
        <main className={styles.root}>
            <section className={`${styles.surface} ${styles.header}`}>
                <p className={styles.eyebrow}>Admin Console</p>
                <h1>Read-only Admin</h1>
                <div className={styles.statusRow}>
                    <span>Current admin session status</span>
                    <SessionBadge state={sessionState} />
                </div>
                <p className={styles.note}>This shell is read-only. No writes, no provider calls, and no production admin auth are enabled.</p>
            </section>

            <section className={`${styles.surface} ${styles.toolbar}`}>
                <input
                    className={styles.searchInput}
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search ISIN, WKN, name, symbol, provider, status..."
                />
                <button type="button" className={styles.clearButton} onClick={() => setSearch("")}>
                    Clear
                </button>
                <span className={styles.subtle}>Matches: {matchCount.toLocaleString()}</span>
            </section>

            <section className={`${styles.surface} ${styles.guard}`}>
                <h2>Guard summary</h2>
                <p>Session check uses <code>/api/admin/session</code>. Mutation actions are blocked by access control.</p>
                <ul>
                    <li>List access: {listAccess.data?.can ? "allowed" : "denied"}</li>
                    <li>Create access: {createAccess.data?.can ? "allowed" : "denied"}</li>
                </ul>
            </section>

            <Section title="Market Data Status" summary={statusData ? `${statusData.instrumentsTotal.toLocaleString()} instruments` : statusError ? "error" : "loading"} open={open.status} onToggle={() => setOpen((prev) => ({ ...prev, status: !prev.status }))}>
                {sessionState !== "enabled" ? <p className={styles.subtle}>Status is unavailable while admin is disabled or unauthorized.</p> : null}
                {statusError ? <p className={styles.errorText}>{statusError}</p> : null}
            </Section>

            <Section title="Unmapped / Open Market Data Assets" summary={`${unmappedRows.length.toLocaleString()} shown`} open={open.unmapped} onToggle={() => setOpen((prev) => ({ ...prev, unmapped: !prev.unmapped }))}>
                {unmappedError ? <p className={styles.errorText}>{unmappedError}</p> : null}
                {unmappedData ? <p className={styles.subtle}>Showing {unmappedRows.length.toLocaleString()} of {unmappedData.totalOpen.toLocaleString()} open cases.</p> : null}
                <DataTable>
                    <tr>
                        <th><SortableHeader label="Prio" column="priority" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th>
                        <th><SortableHeader label="ISIN" column="isin" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th>
                        <th><SortableHeader label="Name" column="displayName" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th>
                        <th><SortableHeader label="Category" column="category" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th>
                        <th><SortableHeader label="Action" column="suggestedAction" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th>
                        <th><SortableHeader label="Status" column="mappingStatus" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th>
                    </tr>
                    {unmappedRows.map((row) => (
                        <tr key={row.isin}>
                            <td>{row.priority}</td><td>{row.isin}</td><td className={styles.truncateCell}>{row.displayName ?? "—"}</td><td>{row.category}</td><td>{row.suggestedAction}</td><td>{row.mappingStatus}</td>
                        </tr>
                    ))}
                </DataTable>
            </Section>

            <Section title="Market Instruments" summary={`${instrumentsRows.length.toLocaleString()} shown`} open={open.instruments} onToggle={() => setOpen((prev) => ({ ...prev, instruments: !prev.instruments }))}>
                {instrumentsError ? <p className={styles.errorText}>{instrumentsError}</p> : null}
                {instrumentsData ? <p className={styles.subtle}>Showing {instrumentsRows.length.toLocaleString()} of {instrumentsData.total.toLocaleString()} instruments.</p> : null}
                <DataTable>
                    <tr>
                        <th><SortableHeader label="ISIN" column="isin" sort={instrumentsSort} onToggle={(k) => toggleSort(instrumentsSort, setInstrumentsSort, k)} /></th>
                        <th><SortableHeader label="Name" column="displayName" sort={instrumentsSort} onToggle={(k) => toggleSort(instrumentsSort, setInstrumentsSort, k)} /></th>
                        <th><SortableHeader label="Type" column="assetType" sort={instrumentsSort} onToggle={(k) => toggleSort(instrumentsSort, setInstrumentsSort, k)} /></th>
                        <th><SortableHeader label="Status" column="marketDataStatus" sort={instrumentsSort} onToggle={(k) => toggleSort(instrumentsSort, setInstrumentsSort, k)} /></th>
                        <th><SortableHeader label="Primary" column="primarySymbol" sort={instrumentsSort} onToggle={(k) => toggleSort(instrumentsSort, setInstrumentsSort, k)} /></th>
                        <th><SortableHeader label="Verified" column="verifiedMappingCount" sort={instrumentsSort} onToggle={(k) => toggleSort(instrumentsSort, setInstrumentsSort, k)} /></th>
                        <th><SortableHeader label="Candidates" column="candidateMappingCount" sort={instrumentsSort} onToggle={(k) => toggleSort(instrumentsSort, setInstrumentsSort, k)} /></th>
                        <th><SortableHeader label="Prices" column="hasPriceData" sort={instrumentsSort} onToggle={(k) => toggleSort(instrumentsSort, setInstrumentsSort, k)} /></th>
                        <th><SortableHeader label="Last price" column="lastPriceDate" sort={instrumentsSort} onToggle={(k) => toggleSort(instrumentsSort, setInstrumentsSort, k)} /></th>
                    </tr>
                    {instrumentsRows.map((row) => (
                        <tr key={row.isin}>
                            <td>{row.isin}</td><td className={styles.truncateCell}>{row.displayName ?? row.name ?? "—"}</td><td>{row.assetType ?? "—"}</td><td>{row.marketDataStatus ?? "unset"}</td><td>{row.primarySymbol ?? "—"}</td><td>{row.verifiedMappingCount}</td><td>{row.candidateMappingCount}</td><td>{row.hasPriceData ? "yes" : "no"}</td><td>{row.lastPriceDate ?? "—"}</td>
                        </tr>
                    ))}
                </DataTable>
            </Section>

            <Section title="Market Symbol Mappings" summary={`${mappingsRows.length.toLocaleString()} shown`} open={open.mappings} onToggle={() => setOpen((prev) => ({ ...prev, mappings: !prev.mappings }))}>
                {mappingsError ? <p className={styles.errorText}>{mappingsError}</p> : null}
                {mappingsData ? <p className={styles.subtle}>Showing {mappingsRows.length.toLocaleString()} of {mappingsData.total.toLocaleString()} mappings.</p> : null}
                <DataTable>
                    <tr>
                        <th><SortableHeader label="ISIN" column="isin" sort={mappingsSort} onToggle={(k) => toggleSort(mappingsSort, setMappingsSort, k)} /></th>
                        <th><SortableHeader label="Provider" column="provider" sort={mappingsSort} onToggle={(k) => toggleSort(mappingsSort, setMappingsSort, k)} /></th>
                        <th><SortableHeader label="Symbol" column="symbol" sort={mappingsSort} onToggle={(k) => toggleSort(mappingsSort, setMappingsSort, k)} /></th>
                        <th><SortableHeader label="Primary" column="isPrimary" sort={mappingsSort} onToggle={(k) => toggleSort(mappingsSort, setMappingsSort, k)} /></th>
                        <th><SortableHeader label="Active" column="isActive" sort={mappingsSort} onToggle={(k) => toggleSort(mappingsSort, setMappingsSort, k)} /></th>
                        <th><SortableHeader label="Verified" column="verifiedAt" sort={mappingsSort} onToggle={(k) => toggleSort(mappingsSort, setMappingsSort, k)} /></th>
                        <th><SortableHeader label="Has prices" column="hasPriceData" sort={mappingsSort} onToggle={(k) => toggleSort(mappingsSort, setMappingsSort, k)} /></th>
                        <th><SortableHeader label="Latest price" column="latestPriceDate" sort={mappingsSort} onToggle={(k) => toggleSort(mappingsSort, setMappingsSort, k)} /></th>
                    </tr>
                    {mappingsRows.map((row) => (
                        <tr key={row.id}>
                            <td>{row.isin}</td><td>{row.provider}</td><td>{row.symbol}</td><td>{row.isPrimary ? "yes" : "no"}</td><td>{row.isActive ? "yes" : "no"}</td><td>{row.verifiedAt ? "yes" : "no"}</td><td>{row.hasPriceData ? "yes" : "no"}</td><td>{row.latestPriceDate ?? "—"}</td>
                        </tr>
                    ))}
                </DataTable>
            </Section>

            <Section title="Market Data Runs" summary={`${runsRows.length.toLocaleString()} shown`} open={open.runs} onToggle={() => setOpen((prev) => ({ ...prev, runs: !prev.runs }))}>
                {runsError ? <p className={styles.errorText}>{runsError}</p> : null}
                {runsData ? <p className={styles.subtle}>Showing {runsRows.length.toLocaleString()} of {runsData.total.toLocaleString()} runs.</p> : null}
                <p className={styles.subtle}>Run actions remain CLI/admin-workflow only.</p>
                <DataTable>
                    <tr>
                        <th><SortableHeader label="Run type" column="runType" sort={runsSort} onToggle={(k) => toggleSort(runsSort, setRunsSort, k)} /></th>
                        <th><SortableHeader label="Status" column="status" sort={runsSort} onToggle={(k) => toggleSort(runsSort, setRunsSort, k)} /></th>
                        <th><SortableHeader label="Provider" column="provider" sort={runsSort} onToggle={(k) => toggleSort(runsSort, setRunsSort, k)} /></th>
                        <th><SortableHeader label="Started" column="startedAt" sort={runsSort} onToggle={(k) => toggleSort(runsSort, setRunsSort, k)} /></th>
                        <th><SortableHeader label="Finished" column="finishedAt" sort={runsSort} onToggle={(k) => toggleSort(runsSort, setRunsSort, k)} /></th>
                        <th><SortableHeader label="Items" column="totalItems" sort={runsSort} onToggle={(k) => toggleSort(runsSort, setRunsSort, k)} /></th>
                        <th><SortableHeader label="Success" column="succeededItems" sort={runsSort} onToggle={(k) => toggleSort(runsSort, setRunsSort, k)} /></th>
                        <th><SortableHeader label="Failed" column="failedItems" sort={runsSort} onToggle={(k) => toggleSort(runsSort, setRunsSort, k)} /></th>
                    </tr>
                    {runsRows.map((row) => (
                        <tr key={row.id}>
                            <td>{row.runType}</td><td>{row.status}</td><td>{row.provider ?? "—"}</td><td>{row.startedAt ?? "—"}</td><td>{row.finishedAt ?? "—"}</td><td>{row.totalItems}</td><td>{row.succeededItems}</td><td>{row.failedItems}</td>
                        </tr>
                    ))}
                </DataTable>
            </Section>
        </main>
    );
}

function DataTable({ children }: { children: React.ReactNode }) {
    const nodes = Array.isArray(children) ? children : [children];
    return (
        <div className={styles.tableWrap}>
            <table className={styles.table}>
                <thead>{nodes[0]}</thead>
                <tbody>{nodes.slice(1)}</tbody>
            </table>
        </div>
    );
}
