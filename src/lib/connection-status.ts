import type { DashboardCache } from "./dashboard-cache";

export type ConnectionStatusKind =
  | "usable"
  | "auth_required"
  | "local_data"
  | "unknown";

export type ConnectionStatusView = {
  kind: ConnectionStatusKind;
  label: string;
  description: string;
  actionLabel: string | null;
  actionHref: string | null;
};

const AUTH_ERROR_CATEGORIES = new Set([
  "auth_error",
  "auth_refresh_failed",
  "missing_access_token",
]);
const TEMPORARY_ERROR_CATEGORIES = new Set(["provider_error", "rate_limit"]);

export function getConnectionStatusView(
  cache: Pick<DashboardCache, "assetCount" | "lastUpdatedAt" | "freshness"> | null,
): ConnectionStatusView {
  const freshness = cache?.freshness ?? null;

  if (
    freshness?.lastRefreshErrorCategory &&
    AUTH_ERROR_CATEGORIES.has(freshness.lastRefreshErrorCategory)
  ) {
    return {
      kind: "auth_required",
      label: "Autorisierung erforderlich",
      description:
        "Die Parqet-Verbindung muss erneuert werden. Lokale Daten bleiben verfügbar.",
      actionLabel: "Parqet erneut verbinden",
      actionHref: "/api/auth/start",
    };
  }

  if (
    freshness?.lastRefreshErrorCategory &&
    TEMPORARY_ERROR_CATEGORIES.has(freshness.lastRefreshErrorCategory) &&
    cache?.lastUpdatedAt
  ) {
    return {
      kind: "usable",
      label: "Lokale Daten vorhanden",
      description:
        "Parqet ist vorübergehend nicht erreichbar. Der lokale Stand bleibt verfügbar.",
      actionLabel: null,
      actionHref: null,
    };
  }

  if (cache?.lastUpdatedAt && (cache.assetCount ?? 0) > 0) {
    return {
      kind: "usable",
      label: "Lokale Daten vorhanden",
      description:
        "Der lokale Stand ist verfügbar. Eine manuelle Aktualisierung kann eine erneute Parqet-Verbindung erfordern.",
      actionLabel: null,
      actionHref: null,
    };
  }

  if (cache?.lastUpdatedAt || freshness?.present) {
    return {
      kind: "local_data",
      label: "Lokaler Stand",
      description: "Ein lokaler Stand ist vorhanden, aber ohne geladene Assets.",
      actionLabel: null,
      actionHref: null,
    };
  }

  return {
    kind: "unknown",
    label: "Status unbekannt",
    description: "Noch kein lokaler Verbindungsstatus vorhanden.",
    actionLabel: "Mit Parqet verbinden",
    actionHref: "/api/auth/start",
  };
}
