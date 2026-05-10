import type { Portfolio, SnapshotFreshness } from "../types";
import type { Activity } from "./activity-types";
import type { NormalizedActivity } from "./normalization";
import type { CorrectedActivity } from "./overrides";
import type { ReconciliationWarning } from "../types";

const MAX_SNAPSHOTS = 6;
const MAX_ACTIVITIES_PER_SNAPSHOT = 15000;
const STALE_AFTER_MS = 5 * 24 * 60 * 60 * 1000;

type SnapshotEntry = {
  key: string;
  loadedAt: string;
  updatedAt: string;
  lastAccessedAt: number;
  portfolioIds: string[];
  authorizedPortfolios: Portfolio[];
  selectedPortfolios: Portfolio[];
  portfolioNameByIdEntries: Array<[string, string]>;
  rawActivityCount: number;
  filteredActivities: Activity[];
  normalizedActivities: NormalizedActivity[];
  correctedActivities: CorrectedActivity<NormalizedActivity>[];
  reconciliationWarnings: ReconciliationWarning[];
  lastRefreshErrorCategory: SnapshotFreshness["lastRefreshErrorCategory"];
};

const snapshots = new Map<string, SnapshotEntry>();

function normalizePortfolioIds(portfolioIds: string[]): string[] {
  return Array.from(
    new Set(portfolioIds.map((id) => id.trim()).filter(Boolean)),
  ).sort();
}

function getSnapshotKey(portfolioIds: string[]): string {
  return normalizePortfolioIds(portfolioIds).join("|");
}

function fingerprint(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function toFreshness(
  entry: SnapshotEntry,
  source: SnapshotFreshness["source"],
): SnapshotFreshness {
  const loadedTime = new Date(entry.loadedAt).getTime();
  const stale = Number.isNaN(loadedTime)
    ? true
    : Date.now() - loadedTime > STALE_AFTER_MS;

  return {
    present: true,
    loadedAt: entry.loadedAt,
    updatedAt: entry.updatedAt,
    status: entry.lastRefreshErrorCategory
      ? "refresh_failed"
      : stale
        ? "stale"
        : "fresh",
    source,
    refreshStatus: source === "provider" ? "refreshed" : "idle",
    stale,
    scope: {
      portfolioCount: entry.portfolioIds.length,
      fingerprint: fingerprint(entry.key),
    },
    lastRefreshErrorCategory: entry.lastRefreshErrorCategory,
  };
}

function evictOldestSnapshots(): void {
  while (snapshots.size > MAX_SNAPSHOTS) {
    const oldest = Array.from(snapshots.values()).sort(
      (left, right) => left.lastAccessedAt - right.lastAccessedAt,
    )[0];

    if (!oldest) return;
    snapshots.delete(oldest.key);
  }
}

export function getActivitySnapshot(
  portfolioIds: string[],
): SnapshotEntry | null {
  const key = getSnapshotKey(portfolioIds);
  const snapshot = snapshots.get(key);

  if (!snapshot) return null;

  snapshot.lastAccessedAt = Date.now();
  return snapshot;
}

export function getActivitySnapshotFreshness(
  portfolioIds: string[],
): SnapshotFreshness {
  const snapshot = getActivitySnapshot(portfolioIds);

  if (!snapshot) {
    return {
      present: false,
      loadedAt: null,
      updatedAt: null,
      status: "missing",
      source: "none",
      refreshStatus: "idle",
      stale: true,
      scope: {
        portfolioCount: normalizePortfolioIds(portfolioIds).length,
        fingerprint: fingerprint(getSnapshotKey(portfolioIds)),
      },
    };
  }

  return toFreshness(snapshot, "snapshot");
}

export function saveActivitySnapshot(
  input: Omit<
    SnapshotEntry,
    | "key"
    | "loadedAt"
    | "updatedAt"
    | "lastAccessedAt"
    | "lastRefreshErrorCategory"
  >,
): SnapshotEntry | null {
  if (input.filteredActivities.length > MAX_ACTIVITIES_PER_SNAPSHOT) {
    return null;
  }

  const now = new Date().toISOString();
  const key = getSnapshotKey(input.portfolioIds);
  const entry: SnapshotEntry = {
    ...input,
    key,
    loadedAt: now,
    updatedAt: now,
    lastAccessedAt: Date.now(),
    lastRefreshErrorCategory: null,
  };

  snapshots.set(key, entry);
  evictOldestSnapshots();

  return entry;
}

export function markActivitySnapshotRefreshFailed(
  portfolioIds: string[],
  category: SnapshotFreshness["lastRefreshErrorCategory"] = "pipeline_error",
): SnapshotFreshness {
  const snapshot = getActivitySnapshot(portfolioIds);

  if (!snapshot) {
    return getActivitySnapshotFreshness(portfolioIds);
  }

  snapshot.updatedAt = new Date().toISOString();
  snapshot.lastRefreshErrorCategory = category;
  return toFreshness(snapshot, "snapshot");
}

export function snapshotEntryToContext(entry: SnapshotEntry) {
  return {
    authorizedPortfolios: entry.authorizedPortfolios,
    selectedPortfolios: entry.selectedPortfolios,
    portfolioNameById: new Map(entry.portfolioNameByIdEntries),
    rawActivities: entry.filteredActivities,
    rawActivityCount: entry.rawActivityCount,
    filteredActivities: entry.filteredActivities,
    normalizedActivities: entry.normalizedActivities,
    correctedActivities: entry.correctedActivities,
    reconciliationWarnings: entry.reconciliationWarnings,
    freshness: toFreshness(entry, "snapshot"),
  };
}

export function snapshotEntryToFreshContext(entry: SnapshotEntry) {
  return {
    ...snapshotEntryToContext(entry),
    freshness: toFreshness(entry, "provider"),
  };
}
