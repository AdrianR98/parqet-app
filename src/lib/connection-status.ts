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
      label: "Neu verbinden",
      description: "Die Parqet-Verbindung muss erneuert werden.",
      actionLabel: "Parqet erneut verbinden",
      actionHref: "/api/auth/start",
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
    actionLabel: "Parqet verbinden",
    actionHref: "/api/auth/start",
  };
}
