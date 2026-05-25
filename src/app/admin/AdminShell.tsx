"use client";

import { useEffect, useMemo, useState } from "react";
import { Refine, useCan, useIsAuthenticated } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { adminAccessControlProvider, adminAuthProvider } from "@/lib/admin/refine";
import styles from "./page.module.css";

type Sort = { key: string; direction: "asc" | "desc" };
type OpenState = { guard: boolean; status: boolean; unmapped: boolean; requests: boolean; instruments: boolean; mappings: boolean; runs: boolean };
type AnyRow = Record<string, unknown>;

type StatusPayload = {
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
type UnmappedRow = { priority: number; isin: string; displayName: string | null; wkn: string | null; mappingStatus: string; category: string; suggestedAction: string; triageHint: string | null; triageReason: string | null; primarySymbol: string | null; marketDataStatus: string | null };
type InstrumentRow = { isin: string; displayName: string | null; name: string | null; assetType: string | null; wkn: string | null; marketDataStatus: string | null; primarySymbol: string | null; verifiedMappingCount: number; candidateMappingCount: number; hasPriceData: boolean; firstPriceDate: string | null; lastPriceDate: string | null };
type MappingRow = { id: string; isin: string; displayName: string | null; provider: string; symbol: string; exchange: string | null; isPrimary: boolean; isActive: boolean; verifiedAt: string | null; hasPriceData: boolean; latestPriceDate: string | null; statusReason: string | null };
type RunsRow = { id: string; runType: string; status: string; provider: string | null; startedAt: string | null; finishedAt: string | null; totalItems: number; succeededItems: number; failedItems: number; latestErrorMessage: string | null };
type RequestRow = { isin: string; displayName: string | null; name: string | null; assetType: string | null; currency: string | null; wkn: string | null; status: string; source: string; firstSeenAt: string; lastSeenAt: string; seenCount: number; notes: string | null };

function normalize(value: unknown) {
    if (value === null || value === undefined) return "";
    return String(value).toLowerCase();
}
function formatDate(value: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}`;
}
function label(value: string | null) {
    if (!value) return "Unset";
    const map: Record<string, string> = {
        failed_or_excluded: "Failed / excluded",
        inspect_instrument: "Inspect instrument",
        unverified_mapping: "Unverified mapping",
        no_mapping: "No mapping",
        failed_validation: "Failed validation",
        manual_review: "Manual review",
        mapping_candidate_needed: "Mapping candidate needed",
        derivative_or_warrant: "Derivative / warrant",
        legacy_or_corporate_action: "Legacy / corporate action",
        add_candidates: "Add candidates",
        validate_candidates: "Validate candidates",
        import_manual_mapping: "Import manual mapping",
        review_derivative_or_exclude: "Review derivative or exclude",
        review_legacy_or_successor: "Review legacy or successor",
        review_failed_validation: "Review failed validation",
        backfill_primary: "Backfill primary",
        unset: "Unset",
    };
    const key = value.toLowerCase();
    if (map[key]) return map[key];
    return key.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
function cmp(a: unknown, b: unknown) {
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
    return normalize(a).localeCompare(normalize(b));
}
function sortRows<T extends AnyRow>(rows: T[], sort: Sort) {
    return [...rows].sort((a, b) => (sort.direction === "asc" ? cmp(a[sort.key], b[sort.key]) : -cmp(a[sort.key], b[sort.key])));
}
function hit(search: string, values: unknown[]) {
    if (!search) return true;
    return values.some((v) => normalize(v).includes(search));
}

function SessionBadge({ state }: { state: "enabled" | "disabled" | "loading" }) {
    if (state === "loading") return <span className={`${styles.badge} ${styles.badgeMuted}`}>Checking session</span>;
    if (state === "enabled") return <span className={`${styles.badge} ${styles.badgeSuccess}`}>Enabled (read-only)</span>;
    return <span className={`${styles.badge} ${styles.badgeWarning}`}>Disabled / Unauthorized</span>;
}
function HeaderSort({ labelText, keyName, sort, onToggle }: { labelText: string; keyName: string; sort: Sort; onToggle: (k: string) => void }) {
    const marker = sort.key === keyName ? (sort.direction === "asc" ? "▲" : "▼") : "↕";
    return <button type="button" className={styles.sortButton} onClick={() => onToggle(keyName)}>{labelText} <span>{marker}</span></button>;
}
function Section({ title, summary, open, toggle, children }: { title: string; summary: string; open: boolean; toggle: () => void; children: React.ReactNode }) {
    return <section className={styles.sectionSurface}><button type="button" className={styles.sectionHeader} onClick={toggle}><span>{title}</span><span className={styles.sectionMeta}>{summary} {open ? "▾" : "▸"}</span></button>{open ? <div className={styles.sectionBody}>{children}</div> : null}</section>;
}
function Table({ head, rows }: { head: React.ReactNode; rows: React.ReactNode }) {
    return <div className={styles.tableWrap}><table className={styles.table}><thead>{head}</thead><tbody>{rows}</tbody></table></div>;
}

export default function AdminShell() {
    return <Refine authProvider={adminAuthProvider} accessControlProvider={adminAccessControlProvider} routerProvider={routerProvider} resources={[]}><AdminPanel /></Refine>;
}

function AdminPanel() {
    const auth = useIsAuthenticated();
    const listAccess = useCan({ resource: "admin", action: "list" });
    const createAccess = useCan({ resource: "admin", action: "create" });
    const session = auth.isLoading ? "loading" : auth.data?.authenticated ? "enabled" : "disabled";

    const [status, setStatus] = useState<StatusPayload | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [unmapped, setUnmapped] = useState<{ totalOpen: number; items: UnmappedRow[] } | null>(null);
    const [unmappedError, setUnmappedError] = useState<string | null>(null);
    const [instruments, setInstruments] = useState<{ total: number; items: InstrumentRow[] } | null>(null);
    const [instrumentsError, setInstrumentsError] = useState<string | null>(null);
    const [mappings, setMappings] = useState<{ total: number; items: MappingRow[] } | null>(null);
    const [mappingsError, setMappingsError] = useState<string | null>(null);
    const [runs, setRuns] = useState<{ total: number; items: RunsRow[] } | null>(null);
    const [runsError, setRunsError] = useState<string | null>(null);
    const [requests, setRequests] = useState<{ total: number; items: RequestRow[] } | null>(null);
    const [requestsError, setRequestsError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const q = search.trim().toLowerCase();
    const [open, setOpen] = useState<OpenState>({ guard: false, status: true, unmapped: true, requests: true, instruments: false, mappings: false, runs: false });

    const [unmappedSort, setUnmappedSort] = useState<Sort>({ key: "priority", direction: "asc" });
    const [instrumentSort, setInstrumentSort] = useState<Sort>({ key: "isin", direction: "asc" });
    const [mappingSort, setMappingSort] = useState<Sort>({ key: "isin", direction: "asc" });
    const [runSort, setRunSort] = useState<Sort>({ key: "startedAt", direction: "desc" });
    const [requestSort, setRequestSort] = useState<Sort>({ key: "lastSeenAt", direction: "desc" });

    const toggleSort = (cur: Sort, set: (s: Sort) => void, key: string) => set(cur.key === key ? { key, direction: cur.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });

    useEffect(() => {
        if (session !== "enabled") return;
        const controller = new AbortController();
        const load = async () => {
            const endpoints = [
                ["/api/admin/market-data/status", setStatus, setStatusError, "Market data status is currently unavailable."],
                ["/api/admin/market-data/unmapped?limit=50", setUnmapped, setUnmappedError, "Open/unmapped market-data assets are currently unavailable."],
                ["/api/admin/market-data/requests?limit=50", setRequests, setRequestsError, "Market data requests are currently unavailable."],
                ["/api/admin/market-data/instruments?limit=50", setInstruments, setInstrumentsError, "Market instruments overview is currently unavailable."],
                ["/api/admin/market-data/mappings?limit=50", setMappings, setMappingsError, "Market symbol mappings overview is currently unavailable."],
                ["/api/admin/market-data/runs?limit=25", setRuns, setRunsError, "Market data runs overview is currently unavailable."],
            ] as const;
            await Promise.all(endpoints.map(async ([url, setData, setErr, msg]) => {
                try {
                    const r = await fetch(url, { method: "GET", cache: "no-store", signal: controller.signal });
                    if (!r.ok) throw new Error("fetch");
                    setData(await r.json());
                    setErr(null);
                } catch (e: unknown) {
                    if (e instanceof Error && e.name === "AbortError") return;
                    setData(null); setErr(msg);
                }
            }));
        };
        void load();
        return () => controller.abort();
    }, [session]);

    const kpis = useMemo(() => {
        if (!status) return [];
        return [
            ["Instruments total", status.instrumentsTotal], ["Mappings total", status.mappingsTotal], ["YFinance mappings", status.yfinanceMappingsTotal], ["Verified mappings", status.verifiedYfinanceMappings], ["Primary mappings", status.primaryYfinanceMappings], ["With verified mapping", status.instrumentsWithVerifiedYfinanceMapping], ["Without any mapping", status.instrumentsWithoutAnyMapping], ["Without primary mapping", status.instrumentsWithoutPrimaryMapping], ["With price data", status.instrumentsWithDailyPriceData], ["With market actions", status.instrumentsWithMarketActions], ["Primary but no prices", status.instrumentsWithPrimaryMappingButNoPriceData], ["Failed validation candidates", status.failedValidationCandidates],
        ] as const;
    }, [status]);

    const unmappedRows = useMemo(() => sortRows((unmapped?.items ?? []).filter((r) => hit(q, [r.isin, r.wkn, r.displayName, r.primarySymbol, r.marketDataStatus, r.mappingStatus, r.category, r.suggestedAction, r.triageHint, r.triageReason])), unmappedSort), [unmapped, q, unmappedSort]);
    const instrumentRows = useMemo(() => sortRows((instruments?.items ?? []).filter((r) => hit(q, [r.isin, r.wkn, r.displayName, r.name, r.primarySymbol, r.marketDataStatus, r.assetType])), instrumentSort), [instruments, q, instrumentSort]);
    const mappingRows = useMemo(() => sortRows((mappings?.items ?? []).filter((r) => hit(q, [r.isin, r.displayName, r.provider, r.symbol, r.exchange, r.statusReason])), mappingSort), [mappings, q, mappingSort]);
    const runRows = useMemo(() => sortRows((runs?.items ?? []).filter((r) => hit(q, [r.runType, r.status, r.provider, r.latestErrorMessage])), runSort), [runs, q, runSort]);
    const requestRows = useMemo(() => sortRows((requests?.items ?? []).filter((r) => hit(q, [r.isin, r.displayName, r.name, r.status, r.source, r.currency, r.wkn])), requestSort), [requests, q, requestSort]);

    useEffect(() => {
        if (!q) return;
        setOpen((prev) => ({ ...prev, unmapped: prev.unmapped || unmappedRows.length > 0, requests: prev.requests || requestRows.length > 0, instruments: prev.instruments || instrumentRows.length > 0, mappings: prev.mappings || mappingRows.length > 0, runs: prev.runs || runRows.length > 0 }));
    }, [q, unmappedRows.length, requestRows.length, instrumentRows.length, mappingRows.length, runRows.length]);

    const statusSummary = session !== "enabled" ? "disabled" : statusError ? "error" : !status ? "loading" : `${status.instrumentsTotal.toLocaleString()} instruments`;
    const unmappedSummary = session !== "enabled" ? "disabled" : unmappedError ? "error" : !unmapped ? "loading" : `${unmappedRows.length.toLocaleString()} shown`;
    const instrumentsSummary = session !== "enabled" ? "disabled" : instrumentsError ? "error" : !instruments ? "loading" : `${instrumentRows.length.toLocaleString()} shown`;
    const mappingsSummary = session !== "enabled" ? "disabled" : mappingsError ? "error" : !mappings ? "loading" : `${mappingRows.length.toLocaleString()} shown`;
    const runsSummary = session !== "enabled" ? "disabled" : runsError ? "error" : !runs ? "loading" : `${runRows.length.toLocaleString()} shown`;
    const requestsSummary = session !== "enabled" ? "disabled" : requestsError ? "error" : !requests ? "loading" : `${requestRows.length.toLocaleString()} shown`;

    return (
        <main className={styles.root}>
            <section className={`${styles.surface} ${styles.headerSurface}`}>
                <p className={styles.eyebrow}>Admin Console</p><h1>Read-only Admin</h1>
                <div className={styles.statusRow}><span>Current admin session status</span><SessionBadge state={session} /></div>
                <p className={styles.note}>This shell is read-only. No writes, no provider calls, and no production admin auth are enabled.</p>
            </section>

            <section className={`${styles.surface} ${styles.toolbar}`}>
                <input className={styles.searchInput} type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ISIN, WKN, name, symbol, provider, status..." />
                {q ? <button type="button" className={styles.clearButton} onClick={() => setSearch("")}>Clear</button> : null}
            </section>

            <Section title="Guard summary" summary="diagnostics" open={open.guard} toggle={() => setOpen((p) => ({ ...p, guard: !p.guard }))}>
                <p className={styles.subtle}>Session endpoint: <code>/api/admin/session</code></p>
                <p className={styles.subtle}>List access: {listAccess.data?.can ? "allowed" : "denied"}</p>
                <p className={styles.subtle}>Create access: {createAccess.data?.can ? "allowed" : "denied"}</p>
            </Section>

            <Section title="Market Data Status" summary={statusSummary} open={open.status} toggle={() => setOpen((p) => ({ ...p, status: !p.status }))}>
                {session !== "enabled" ? <p className={styles.subtle}>Status is unavailable while admin is disabled or unauthorized.</p> : null}
                {statusError ? <p className={styles.errorText}>{statusError}</p> : null}
                {session === "enabled" && !status && !statusError ? <p className={styles.subtle}>Loading market data status...</p> : null}
                {status ? (
                    <>
                        <section className={styles.kpiGrid}>{kpis.map(([k, v]) => <article className={styles.kpiCard} key={k}><p>{k}</p><strong>{v.toLocaleString()}</strong></article>)}</section>
                        <section className={styles.breakdownGrid}>
                            <article className={styles.card}><h3>Market data status counts</h3><ul className={styles.cleanList}>{Object.entries(status.marketDataStatusCounts).map(([s, c]) => <li key={s}><span>{label(s)}</span><strong>{c.toLocaleString()}</strong></li>)}</ul></article>
                            <article className={styles.card}><h3>Reference source counts</h3><ul className={styles.cleanList}>{status.referenceSourceCounts.map((r) => <li key={r.sourceKey}><span>{r.sourceKey}</span><strong>{r.rowCount.toLocaleString()}</strong></li>)}</ul></article>
                        </section>
                    </>
                ) : null}
            </Section>

            <Section title="Unmapped / Open Market Data Assets" summary={unmappedSummary} open={open.unmapped} toggle={() => setOpen((p) => ({ ...p, unmapped: !p.unmapped }))}>
                {session === "enabled" && !unmapped && !unmappedError ? <p className={styles.subtle}>Loading unmapped/open assets...</p> : null}
                {unmappedError ? <p className={styles.errorText}>{unmappedError}</p> : null}
                {unmapped ? <p className={styles.subtle}>Showing {unmappedRows.length.toLocaleString()} of {unmapped.totalOpen.toLocaleString()} open cases.</p> : null}
                {unmapped && unmappedRows.length === 0 ? <p className={styles.subtle}>No open/unmapped market-data assets for the current filter.</p> : null}
                {unmapped && unmappedRows.length > 0 ? (
                    <Table head={<tr><th><HeaderSort labelText="Prio" keyName="priority" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th><th><HeaderSort labelText="ISIN" keyName="isin" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th><th><HeaderSort labelText="Name" keyName="displayName" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th><th><HeaderSort labelText="Category" keyName="category" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th><th><HeaderSort labelText="Action" keyName="suggestedAction" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th><th>Hint</th><th><HeaderSort labelText="Status" keyName="mappingStatus" sort={unmappedSort} onToggle={(k) => toggleSort(unmappedSort, setUnmappedSort, k)} /></th></tr>}
                        rows={unmappedRows.map((r) => <tr key={r.isin}><td>{r.priority}</td><td className={styles.monoCell}>{r.isin}</td><td className={styles.truncateCell}>{r.displayName ?? "—"}</td><td>{label(r.category)}</td><td>{label(r.suggestedAction)}</td><td className={styles.hintCell} title={r.triageHint ?? undefined}><span className={styles.hintText}>{r.triageHint ?? "—"}</span>{r.triageReason ? <span className={styles.hintReason} title={r.triageReason}>{r.triageReason}</span> : null}</td><td><span className={styles.badgeTiny}>{label(r.mappingStatus)}</span></td></tr>)} />
                ) : null}
            </Section>

            <Section title="Market Data Requests / Unknown Asset Queue" summary={requestsSummary} open={open.requests} toggle={() => setOpen((p) => ({ ...p, requests: !p.requests }))}>
                {session === "enabled" && !requests && !requestsError ? <p className={styles.subtle}>Loading market data requests...</p> : null}
                {requestsError ? <p className={styles.errorText}>{requestsError}</p> : null}
                {requests ? <p className={styles.subtle}>Showing {requestRows.length.toLocaleString()} of {requests.total.toLocaleString()} requests.</p> : null}
                <p className={styles.subtle}>Resolution remains CLI/admin workflow only.</p>
                {requests && requestRows.length === 0 ? <p className={styles.subtle}>No market data requests for the current filter.</p> : null}
                {requests && requestRows.length > 0 ? (
                    <Table head={<tr><th><HeaderSort labelText="ISIN" keyName="isin" sort={requestSort} onToggle={(k) => toggleSort(requestSort, setRequestSort, k)} /></th><th><HeaderSort labelText="Name" keyName="displayName" sort={requestSort} onToggle={(k) => toggleSort(requestSort, setRequestSort, k)} /></th><th><HeaderSort labelText="Status" keyName="status" sort={requestSort} onToggle={(k) => toggleSort(requestSort, setRequestSort, k)} /></th><th><HeaderSort labelText="Source" keyName="source" sort={requestSort} onToggle={(k) => toggleSort(requestSort, setRequestSort, k)} /></th><th><HeaderSort labelText="Seen" keyName="seenCount" sort={requestSort} onToggle={(k) => toggleSort(requestSort, setRequestSort, k)} /></th><th><HeaderSort labelText="First seen" keyName="firstSeenAt" sort={requestSort} onToggle={(k) => toggleSort(requestSort, setRequestSort, k)} /></th><th><HeaderSort labelText="Last seen" keyName="lastSeenAt" sort={requestSort} onToggle={(k) => toggleSort(requestSort, setRequestSort, k)} /></th></tr>}
                        rows={requestRows.map((r) => <tr key={r.isin}><td className={styles.monoCell}>{r.isin}</td><td className={styles.truncateCell}>{r.displayName ?? r.name ?? "—"}</td><td><span className={styles.badgeTiny}>{label(r.status)}</span></td><td>{label(r.source)}</td><td>{r.seenCount}</td><td>{formatDate(r.firstSeenAt)}</td><td>{formatDate(r.lastSeenAt)}</td></tr>)} />
                ) : null}
            </Section>

            <Section title="Market Instruments" summary={instrumentsSummary} open={open.instruments} toggle={() => setOpen((p) => ({ ...p, instruments: !p.instruments }))}>
                {session === "enabled" && !instruments && !instrumentsError ? <p className={styles.subtle}>Loading market instruments...</p> : null}
                {instrumentsError ? <p className={styles.errorText}>{instrumentsError}</p> : null}
                {instruments ? <p className={styles.subtle}>Showing {instrumentRows.length.toLocaleString()} of {instruments.total.toLocaleString()} instruments.</p> : null}
                {instruments && instrumentRows.length === 0 ? <p className={styles.subtle}>No market instruments for the current filter.</p> : null}
                {instruments && instrumentRows.length > 0 ? (
                    <Table head={<tr><th><HeaderSort labelText="ISIN" keyName="isin" sort={instrumentSort} onToggle={(k) => toggleSort(instrumentSort, setInstrumentSort, k)} /></th><th><HeaderSort labelText="Name" keyName="displayName" sort={instrumentSort} onToggle={(k) => toggleSort(instrumentSort, setInstrumentSort, k)} /></th><th><HeaderSort labelText="Type" keyName="assetType" sort={instrumentSort} onToggle={(k) => toggleSort(instrumentSort, setInstrumentSort, k)} /></th><th><HeaderSort labelText="Status" keyName="marketDataStatus" sort={instrumentSort} onToggle={(k) => toggleSort(instrumentSort, setInstrumentSort, k)} /></th><th><HeaderSort labelText="Primary" keyName="primarySymbol" sort={instrumentSort} onToggle={(k) => toggleSort(instrumentSort, setInstrumentSort, k)} /></th><th><HeaderSort labelText="Verified" keyName="verifiedMappingCount" sort={instrumentSort} onToggle={(k) => toggleSort(instrumentSort, setInstrumentSort, k)} /></th><th><HeaderSort labelText="Candidates" keyName="candidateMappingCount" sort={instrumentSort} onToggle={(k) => toggleSort(instrumentSort, setInstrumentSort, k)} /></th><th><HeaderSort labelText="Prices" keyName="hasPriceData" sort={instrumentSort} onToggle={(k) => toggleSort(instrumentSort, setInstrumentSort, k)} /></th><th><HeaderSort labelText="Last price" keyName="lastPriceDate" sort={instrumentSort} onToggle={(k) => toggleSort(instrumentSort, setInstrumentSort, k)} /></th></tr>}
                        rows={instrumentRows.map((r) => <tr key={r.isin}><td className={styles.monoCell}>{r.isin}</td><td className={styles.truncateCell}>{r.displayName ?? r.name ?? "—"}</td><td>{r.assetType ?? "—"}</td><td><span className={styles.badgeTiny}>{label(r.marketDataStatus ?? "unset")}</span></td><td className={styles.monoCell}>{r.primarySymbol ?? "—"}</td><td>{r.verifiedMappingCount}</td><td>{r.candidateMappingCount}</td><td><span className={styles.badgeTiny}>{r.hasPriceData ? "Yes" : "No"}</span></td><td>{formatDate(r.lastPriceDate)}</td></tr>)} />
                ) : null}
            </Section>

            <Section title="Market Symbol Mappings" summary={mappingsSummary} open={open.mappings} toggle={() => setOpen((p) => ({ ...p, mappings: !p.mappings }))}>
                {session === "enabled" && !mappings && !mappingsError ? <p className={styles.subtle}>Loading market symbol mappings...</p> : null}
                {mappingsError ? <p className={styles.errorText}>{mappingsError}</p> : null}
                {mappings ? <p className={styles.subtle}>Showing {mappingRows.length.toLocaleString()} of {mappings.total.toLocaleString()} mappings.</p> : null}
                {mappings && mappingRows.length === 0 ? <p className={styles.subtle}>No market symbol mappings for the current filter.</p> : null}
                {mappings && mappingRows.length > 0 ? (
                    <Table head={<tr><th><HeaderSort labelText="ISIN" keyName="isin" sort={mappingSort} onToggle={(k) => toggleSort(mappingSort, setMappingSort, k)} /></th><th><HeaderSort labelText="Provider" keyName="provider" sort={mappingSort} onToggle={(k) => toggleSort(mappingSort, setMappingSort, k)} /></th><th><HeaderSort labelText="Symbol" keyName="symbol" sort={mappingSort} onToggle={(k) => toggleSort(mappingSort, setMappingSort, k)} /></th><th><HeaderSort labelText="Primary" keyName="isPrimary" sort={mappingSort} onToggle={(k) => toggleSort(mappingSort, setMappingSort, k)} /></th><th><HeaderSort labelText="Active" keyName="isActive" sort={mappingSort} onToggle={(k) => toggleSort(mappingSort, setMappingSort, k)} /></th><th><HeaderSort labelText="Verified" keyName="verifiedAt" sort={mappingSort} onToggle={(k) => toggleSort(mappingSort, setMappingSort, k)} /></th><th><HeaderSort labelText="Has prices" keyName="hasPriceData" sort={mappingSort} onToggle={(k) => toggleSort(mappingSort, setMappingSort, k)} /></th><th><HeaderSort labelText="Latest price" keyName="latestPriceDate" sort={mappingSort} onToggle={(k) => toggleSort(mappingSort, setMappingSort, k)} /></th></tr>}
                        rows={mappingRows.map((r) => <tr key={r.id}><td className={styles.monoCell}>{r.isin}</td><td>{r.provider}</td><td className={styles.monoCell}>{r.symbol}</td><td><span className={styles.badgeTiny}>{r.isPrimary ? "Primary" : "Secondary"}</span></td><td><span className={styles.badgeTiny}>{r.isActive ? "Active" : "Inactive"}</span></td><td><span className={styles.badgeTiny}>{r.verifiedAt ? "Verified" : "Unverified"}</span></td><td><span className={styles.badgeTiny}>{r.hasPriceData ? "Yes" : "No"}</span></td><td>{formatDate(r.latestPriceDate)}</td></tr>)} />
                ) : null}
            </Section>

            <Section title="Market Data Runs" summary={runsSummary} open={open.runs} toggle={() => setOpen((p) => ({ ...p, runs: !p.runs }))}>
                {session === "enabled" && !runs && !runsError ? <p className={styles.subtle}>Loading market data runs...</p> : null}
                {runsError ? <p className={styles.errorText}>{runsError}</p> : null}
                {runs ? <p className={styles.subtle}>Showing {runRows.length.toLocaleString()} of {runs.total.toLocaleString()} runs.</p> : null}
                <p className={styles.subtle}>Run actions remain CLI/admin-workflow only.</p>
                {runs && runRows.length === 0 ? <p className={styles.subtle}>No market data runs for the current filter.</p> : null}
                {runs && runRows.length > 0 ? (
                    <Table head={<tr><th><HeaderSort labelText="Run type" keyName="runType" sort={runSort} onToggle={(k) => toggleSort(runSort, setRunSort, k)} /></th><th><HeaderSort labelText="Status" keyName="status" sort={runSort} onToggle={(k) => toggleSort(runSort, setRunSort, k)} /></th><th><HeaderSort labelText="Provider" keyName="provider" sort={runSort} onToggle={(k) => toggleSort(runSort, setRunSort, k)} /></th><th><HeaderSort labelText="Started" keyName="startedAt" sort={runSort} onToggle={(k) => toggleSort(runSort, setRunSort, k)} /></th><th><HeaderSort labelText="Finished" keyName="finishedAt" sort={runSort} onToggle={(k) => toggleSort(runSort, setRunSort, k)} /></th><th><HeaderSort labelText="Items" keyName="totalItems" sort={runSort} onToggle={(k) => toggleSort(runSort, setRunSort, k)} /></th><th><HeaderSort labelText="Success" keyName="succeededItems" sort={runSort} onToggle={(k) => toggleSort(runSort, setRunSort, k)} /></th><th><HeaderSort labelText="Failed" keyName="failedItems" sort={runSort} onToggle={(k) => toggleSort(runSort, setRunSort, k)} /></th></tr>}
                        rows={runRows.map((r) => <tr key={r.id}><td>{label(r.runType)}</td><td><span className={styles.badgeTiny}>{label(r.status)}</span></td><td>{r.provider ?? "—"}</td><td>{formatDate(r.startedAt)}</td><td>{formatDate(r.finishedAt)}</td><td>{r.totalItems}</td><td>{r.succeededItems}</td><td>{r.failedItems}</td></tr>)} />
                ) : null}
            </Section>
        </main>
    );
}
