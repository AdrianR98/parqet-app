"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  clearLocalAssetTraceState,
  loadKnownPortfolios,
  loadPortfolioScope,
  loadRevealBlockSize,
  notifyLocalSettingsChanged,
  REVEAL_BLOCK_SIZE_OPTIONS,
  resolvePortfolioScope,
  savePortfolioScope,
  saveRevealBlockSize,
  subscribeToLocalSettings,
  type AppearanceMode,
  type PortfolioScope,
  type RevealBlockSize,
} from "../../../lib/app-settings";
import {
  clearDashboardCache,
  loadDashboardCache,
} from "../../../lib/dashboard-cache";
import { persistDashboardCacheWrite } from "../../../lib/dashboard-cache-writer";
import { getConnectionStatusView } from "../../../lib/connection-status";
import { resolveGlobalAssetProductGuardEnabled } from "../../../lib/dashboard-helpers";
import type { DashboardCache } from "../../../lib/dashboard-cache";
import type { AssetsApiResponse, Portfolio } from "../../../lib/types";
import { useTheme } from "../../../hooks/use-theme";
import styles from "./SettingsPage.module.css";

const APPEARANCE_OPTIONS: {
  value: AppearanceMode;
  label: string;
  description: string;
}[] = [
  {
    value: "system",
    label: "System",
    description: "Folgt der Geräteeinstellung.",
  },
  {
    value: "light",
    label: "Hell",
    description: "Helle AssetTrace-Oberfläche.",
  },
  {
    value: "dark",
    label: "Dunkel",
    description: "Dunkle AssetTrace-Oberfläche.",
  },
];

type SettingsSnapshot = {
  knownPortfolios: Portfolio[];
  portfolioScope: PortfolioScope;
  revealBlockSize: RevealBlockSize;
  cacheUpdatedAt: string | null;
  cacheAssetCount: number;
  cacheActivityCount: number;
  cacheFreshness: DashboardCache["freshness"] | null;
  connectionStatus: ReturnType<typeof getConnectionStatusView>;
};

const EMPTY_PORTFOLIO_SCOPE: PortfolioScope = {
  mode: "all",
  selectedPortfolioIds: [],
};

const EMPTY_SETTINGS_SNAPSHOT: SettingsSnapshot = {
  knownPortfolios: [],
  portfolioScope: EMPTY_PORTFOLIO_SCOPE,
  revealBlockSize: 50,
  cacheUpdatedAt: null,
  cacheAssetCount: 0,
  cacheActivityCount: 0,
  cacheFreshness: null,
  connectionStatus: getConnectionStatusView(null),
};

type ConnectionRefreshState =
  | "idle"
  | "loading"
  | "success"
  | "warning"
  | "error"
  | "auth";

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "Kein geladener Stand";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function scopeToSelectedIds(
  scope: PortfolioScope,
  portfolios: Portfolio[],
): string[] {
  return resolvePortfolioScope(scope, portfolios).selectedPortfolioIds;
}

function formatPortfolioCount(count: number): string {
  if (count === 0) return "Keine Portfolios";
  if (count === 1) return "1 Portfolio";
  return `${count} Portfolios`;
}

function readSettingsSnapshot(): SettingsSnapshot {
  const cache = loadDashboardCache();

  return {
    knownPortfolios: loadKnownPortfolios(),
    portfolioScope: loadPortfolioScope(),
    revealBlockSize: loadRevealBlockSize(),
    cacheUpdatedAt: cache?.lastUpdatedAt ?? null,
    cacheAssetCount: cache?.assetCount ?? 0,
    cacheActivityCount: cache?.activityItems?.length ?? 0,
    cacheFreshness: cache?.freshness ?? null,
    connectionStatus: getConnectionStatusView(cache),
  };
}

function getSettingsSnapshot(): string {
  return JSON.stringify(readSettingsSnapshot());
}

function getServerSettingsSnapshot(): string {
  return JSON.stringify(EMPTY_SETTINGS_SNAPSHOT);
}

export default function SettingsPage() {
  const { appearanceMode, resolvedTheme, setAppearanceMode } = useTheme();
  const settingsSnapshot = useSyncExternalStore(
    subscribeToLocalSettings,
    getSettingsSnapshot,
    getServerSettingsSnapshot,
  );
  const {
    knownPortfolios,
    portfolioScope,
    revealBlockSize,
    cacheUpdatedAt,
    cacheAssetCount,
    cacheActivityCount,
    cacheFreshness,
    connectionStatus,
  } = useMemo(
    () => JSON.parse(settingsSnapshot) as SettingsSnapshot,
    [settingsSnapshot],
  );
  const [resetMessage, setResetMessage] = useState("");
  const [connectionRefreshState, setConnectionRefreshState] =
    useState<ConnectionRefreshState>("idle");
  const [connectionRefreshMessage, setConnectionRefreshMessage] = useState("");

  const scopeResolution = useMemo(
    () => resolvePortfolioScope(portfolioScope, knownPortfolios),
    [portfolioScope, knownPortfolios],
  );
  const selectedIds = useMemo(
    () => scopeToSelectedIds(portfolioScope, knownPortfolios),
    [portfolioScope, knownPortfolios],
  );

  function setScope(nextScope: PortfolioScope) {
    savePortfolioScope(nextScope);
    setResetMessage(
      "Portfolio-Scope lokal gespeichert. Es wurden keine Parqet-Daten geladen.",
    );
  }

  function setRevealSize(size: RevealBlockSize) {
    saveRevealBlockSize(size);
    notifyLocalSettingsChanged();
    setResetMessage(
      "Reveal-Größe lokal gespeichert. Es wurden keine Parqet-Daten geladen.",
    );
  }

  function togglePortfolio(portfolioId: string) {
    const nextSelectedIds = selectedIds.includes(portfolioId)
      ? selectedIds.filter((id) => id !== portfolioId)
      : [...selectedIds, portfolioId];

    setScope({ mode: "manual", selectedPortfolioIds: nextSelectedIds });
  }

  function clearDashboardOnly() {
    clearDashboardCache();
    notifyLocalSettingsChanged();
    setResetMessage(
      "Der lokale Dashboard-Cache wurde gelöscht. Parqet-Daten bleiben unverändert.",
    );
  }

  function resetLocalSettings() {
    clearDashboardCache();
    clearLocalAssetTraceState();
    setAppearanceMode("system");
    notifyLocalSettingsChanged();
    setResetMessage(
      "Lokale UI-Einstellungen und Cache wurden zurückgesetzt. In Parqet wurde nichts gelöscht.",
    );
  }

  const diagnosticsEnabled = process.env.NODE_ENV !== "production";
  const canRunConnectionRefresh =
    knownPortfolios.length > 0 && selectedIds.length > 0;

  async function refreshParqetDataLocally() {
    if (!canRunConnectionRefresh) {
      setConnectionRefreshState("error");
      setConnectionRefreshMessage(
        "Parqet-Daten konnten nicht lokal erneuert werden.",
      );
      return;
    }

    setConnectionRefreshState("loading");
    setConnectionRefreshMessage("Parqet-Daten werden lokal aufbereitet …");

    try {
      const params = new URLSearchParams();
      for (const portfolioId of selectedIds) {
        params.append("portfolioId", portfolioId);
      }
      params.set("refresh", "1");

      const response = await fetch(`/api/parqet/assets?${params.toString()}`);
      const raw = await response.text();
      const data = JSON.parse(raw) as AssetsApiResponse;

      if (!data.ok) {
        if (data.authRequired) {
          setConnectionRefreshState("auth");
          setConnectionRefreshMessage("Parqet-Verbindung muss erneuert werden.");
          return;
        }

        setConnectionRefreshState("error");
        setConnectionRefreshMessage("Parqet-Daten konnten nicht lokal erneuert werden.");
        return;
      }

      const prepared = persistDashboardCacheWrite({
        response: data,
        selectedPortfolioIds: selectedIds,
        guardEnabled: resolveGlobalAssetProductGuardEnabled(),
      });

      if (prepared.selectedAssets.length === 0) {
        setConnectionRefreshState("warning");
        setConnectionRefreshMessage(
          "Lokaler Stand wurde aktualisiert. Der aktuelle Scope enthält keine Assets.",
        );
        return;
      }

      setConnectionRefreshState("success");
      setConnectionRefreshMessage("Lokaler Stand wurde aktualisiert.");
    } catch {
      setConnectionRefreshState("error");
      setConnectionRefreshMessage(
        "Parqet-Daten konnten nicht lokal erneuert werden.",
      );
    }
  }

  return (
    <main className={`app-content ${styles.page}`}>
      <section className={`ui-surface ${styles.hero}`}>
        <p className={styles.eyebrow}>AssetTrace · Einstellungen</p>
        <h1 className={styles.title}>Einstellungen</h1>
        <p className={styles.description}>
          Steuere Darstellung, Portfolio-Scope, Verbindungshinweise und lokale
          Datenschutz-/Debug-Optionen. Portfolio-/UI-Einstellungen bleiben
          lokal; Parqet wird nur über explizite Aktionen abgerufen.
        </p>
      </section>

      <div className={styles.grid}>
        <section
          className={`ui-surface ${styles.card}`}
          aria-labelledby="appearance-heading"
        >
          <div className={styles.cardHeader}>
            <h2 id="appearance-heading" className={styles.cardTitle}>
              Darstellung
            </h2>
            <p className={styles.text}>
              Wähle, ob AssetTrace der Geräteeinstellung folgt oder dauerhaft
              hell bzw. dunkel angezeigt wird.
            </p>
          </div>

          <div
            className={styles.segmented}
            role="group"
            aria-label="Darstellungsmodus"
          >
            {APPEARANCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.segmentButton} ${appearanceMode === option.value ? styles.segmentButtonActive : ""}`}
                onClick={() => setAppearanceMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className={styles.meta}>
            Aktiv: {resolvedTheme === "dark" ? "Dunkel" : "Hell"}. Ungültige
            gespeicherte Werte fallen auf System zurück.
          </p>
        </section>

        <section
          className={`ui-surface ${styles.card}`}
          aria-labelledby="reveal-heading"
        >
          <div className={styles.cardHeader}>
            <h2 id="reveal-heading" className={styles.cardTitle}>
              Listenanzeige
            </h2>
            <p className={styles.text}>
              Wähle, wie viele lokale Zeilen Dashboard, Timeline und Reports
              pro Schritt anzeigen. Die vollständigen lokalen Daten bleiben die
              Basis für Summen und Exporte.
            </p>
          </div>

          <div
            className={styles.segmented}
            role="group"
            aria-label="Reveal-Größe"
          >
            {REVEAL_BLOCK_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                className={`${styles.segmentButton} ${revealBlockSize === size ? styles.segmentButtonActive : ""}`}
                onClick={() => setRevealSize(size)}
              >
                {size}
              </button>
            ))}
          </div>
          <p className={styles.meta}>
            Aktiv: {revealBlockSize} Zeilen pro Schritt. Ungültige gespeicherte
            Werte fallen auf 50 zurück.
          </p>
        </section>

        <section
          className={`ui-surface ${styles.card}`}
          aria-labelledby="scope-heading"
        >
          <div className={styles.cardHeader}>
            <h2 id="scope-heading" className={styles.cardTitle}>
              Portfolio/Daten
            </h2>
            <p className={styles.text}>
              Autorisierte Portfolios sind die lokal bekannte Liste. Der Scope
              ist deine Auswahl daraus; geladene Daten bleiben der letzte
              Dashboard-Stand.
            </p>
          </div>

          {knownPortfolios.length === 0 ? (
            <div className="ui-banner ui-banner-info">
              Noch keine lokal bekannte Portfolio-Liste vorhanden. Öffne das
              Dashboard, verbinde Parqet und aktualisiere anschließend den
              lokalen Stand über die Verbindungskarte.
            </div>
          ) : (
            <>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="ui-btn ui-btn-secondary"
                  onClick={() =>
                    setScope({ mode: "all", selectedPortfolioIds: [] })
                  }
                >
                  Alle
                </button>
                <button
                  type="button"
                  className="ui-btn ui-btn-secondary"
                  onClick={() =>
                    setScope({
                      mode: "manual",
                      selectedPortfolioIds: selectedIds,
                    })
                  }
                >
                  Manuelle Auswahl
                </button>
              </div>
              <div className={styles.portfolioList}>
                {knownPortfolios.map((portfolio) => (
                  <label key={portfolio.id} className={styles.portfolioItem}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(portfolio.id)}
                      disabled={portfolioScope.mode === "all"}
                      onChange={() => togglePortfolio(portfolio.id)}
                    />
                    <span>{portfolio.name}</span>
                  </label>
                ))}
              </div>
              <p className={styles.meta}>
                Autorisiert: {formatPortfolioCount(knownPortfolios.length)}.
              </p>
              <p className={styles.meta}>
                Aktueller Scope:{" "}
                {portfolioScope.mode === "all"
                  ? `Alle (${selectedIds.length})`
                  : `${selectedIds.length} ausgewählt`}
                . Geladener Stand:{" "}
                {cacheUpdatedAt
                  ? formatPortfolioCount(cacheFreshness?.scope.portfolioCount ?? 0)
                  : "kein lokaler Stand"}
                .
              </p>
              {portfolioScope.mode === "manual" &&
              portfolioScope.selectedPortfolioIds.length > 0 &&
              selectedIds.length === 0 ? (
                <p className={styles.meta}>
                  Die manuelle Auswahl enthält aktuell keine Portfolios im lokalen Datenstand.
                </p>
              ) : null}
              {scopeResolution.missingPortfolioIds.length > 0 ? (
                <p className={styles.meta}>
                  Ausgewählt, aber lokal nicht verfügbar: {scopeResolution.missingPortfolioIds.length}.
                </p>
              ) : null}
              <p className={styles.meta}>
                Scope-Änderungen speichern nur die Auswahl. Den lokalen
                Parqet-Stand aktualisierst du explizit über Verbindung.
              </p>
            </>
          )}

          {scopeResolution.missingPortfolioIds.length > 0 ? (
            <div className="ui-banner ui-banner-info">
              Gespeicherte Portfolios sind nicht mehr lokal verfügbar.
              Die manuelle Auswahl bleibt erhalten und wird nicht implizit auf „Alle“ gesetzt.
            </div>
          ) : null}
        </section>

        <section
          className={`ui-surface ${styles.card}`}
          aria-labelledby="connection-heading"
        >
          <div className={styles.cardHeader}>
            <h2 id="connection-heading" className={styles.cardTitle}>
              Verbindung
            </h2>
            <p className={styles.text}>
              AssetTrace nutzt Parqet-Daten nur über die autorisierte
              Verbindung. Navigation und Scope-Wechsel laden keine neuen Daten
              im Hintergrund.
            </p>
          </div>
          <div className="ui-banner ui-banner-info">
            Status wird nur aus dem lokalen Stand abgeleitet. Navigation und
            Scope-Wechsel laden weiterhin keine Daten automatisch.
          </div>
          <div
            className={`${styles.connectionStatus} ${styles[`connection_${connectionStatus.kind}`]}`}
            aria-label="Parqet-Verbindungsstatus"
          >
            <span className={styles.connectionLabel}>{connectionStatus.label}</span>
            <span className={styles.connectionDescription}>
              {connectionStatus.description}
            </span>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className="ui-btn ui-btn-secondary"
              onClick={refreshParqetDataLocally}
              disabled={!canRunConnectionRefresh || connectionRefreshState === "loading"}
            >
              Parqet-Daten lokal erneuern
            </button>
            {connectionStatus.actionHref && connectionStatus.actionLabel ? (
              <a
                className="ui-btn ui-btn-secondary"
                href={connectionStatus.actionHref}
              >
                {connectionStatus.actionLabel}
              </a>
            ) : null}
          </div>
          <p className={styles.meta}>
            Ruft Parqet ab, normalisiert die Daten und speichert den lokalen Stand neu.
          </p>
          {!canRunConnectionRefresh ? (
            <p className={styles.meta}>
              Für diese Aktion müssen zuerst autorisierte Portfolios lokal bekannt sein
              und im Scope ausgewählt werden.
            </p>
          ) : null}
          {connectionRefreshMessage ? (
            <div
              className={
                connectionRefreshState === "success"
                  ? "ui-banner ui-banner-info"
                  : connectionRefreshState === "warning"
                    ? "ui-banner ui-banner-info"
                    : connectionRefreshState === "loading"
                      ? "ui-banner ui-banner-info"
                      : connectionRefreshState === "auth"
                        ? "ui-banner ui-banner-error"
                        : "ui-banner ui-banner-error"
              }
            >
              {connectionRefreshMessage}
            </div>
          ) : null}
        </section>

        <section
          className={`ui-surface ${styles.card}`}
          aria-labelledby="privacy-heading"
        >
          <div className={styles.cardHeader}>
            <h2 id="privacy-heading" className={styles.cardTitle}>
              Datenschutz/Debug
            </h2>
            <p className={styles.text}>
              Lokale UI-Einstellungen können im Browser gespeichert werden.
              Debug-Ansichten dürfen keine Tokens, Cookies oder Rohdaten zeigen.
            </p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className="ui-btn ui-btn-secondary"
              onClick={clearDashboardOnly}
            >
              Lokalen Dashboard-Cache löschen
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-secondary"
              onClick={resetLocalSettings}
            >
              Lokale Einstellungen zurücksetzen
            </button>
          </div>
          <p className={styles.meta}>
            Diese Aktionen löschen keine Parqet-Daten und führen keine
            serverseitige Aktion aus.
          </p>
          {resetMessage ? (
            <div className="ui-banner ui-banner-info">{resetMessage}</div>
          ) : null}

          {diagnosticsEnabled ? (
            <div
              className={styles.diagnosticsGrid}
              aria-label="Lokale Entwicklerdiagnose"
            >
              <div className={styles.diagnosticItem}>
                <span>Datenstand</span>
                <span className={styles.diagnosticValue}>
                  {formatDateTime(cacheUpdatedAt)}
                </span>
              </div>
              <div className={styles.diagnosticItem}>
                <span>Snapshot/Cache</span>
                <span className={styles.diagnosticValue}>
                  {cacheUpdatedAt
                    ? "Lokaler Dashboard-Cache vorhanden"
                    : "Kein lokaler Cache"}
                </span>
              </div>
              <div className={styles.diagnosticItem}>
                <span>Snapshot/Freshness</span>
                <span className={styles.diagnosticValue}>
                  {cacheFreshness?.status ?? "missing"} ·{" "}
                  {cacheFreshness?.source ?? "none"}
                </span>
              </div>
              <div className={styles.diagnosticItem}>
                <span>Geladener Scope</span>
                <span className={styles.diagnosticValue}>
                  {cacheFreshness
                    ? formatPortfolioCount(cacheFreshness.scope.portfolioCount)
                    : "Kein Snapshot"}
                </span>
              </div>
              <div className={styles.diagnosticItem}>
                <span>Letzter Refresh-Fehler</span>
                <span className={styles.diagnosticValue}>
                  {cacheFreshness?.lastRefreshErrorCategory ?? "Keiner"}
                </span>
              </div>
              <div className={styles.diagnosticItem}>
                <span>Asset-/Activity-Daten</span>
                <span className={styles.diagnosticValue}>
                  {cacheAssetCount} Assets · {cacheActivityCount} lokale
                  Activities
                </span>
              </div>
              <div className={styles.diagnosticItem}>
                <span>API-Budget</span>
                <span className={styles.diagnosticValue}>
                  Keine Diagnose-Provider-Calls
                </span>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
