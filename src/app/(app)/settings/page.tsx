"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  clearParqetLocalUserData,
  loadRevealBlockSize,
  notifyLocalSettingsChanged,
  REVEAL_BLOCK_SIZE_OPTIONS,
  saveRevealBlockSize,
  subscribeToLocalSettings,
  type AppearanceMode,
  type RevealBlockSize,
} from "../../../lib/app-settings";
import { loadDashboardCache } from "../../../lib/dashboard-cache";
import { getConnectionStatusView } from "../../../lib/connection-status";
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
  revealBlockSize: RevealBlockSize;
  connectionStatus: ReturnType<typeof getConnectionStatusView>;
};

const EMPTY_SETTINGS_SNAPSHOT: SettingsSnapshot = {
  revealBlockSize: 50,
  connectionStatus: getConnectionStatusView(null),
};

type ActionState = "idle" | "loading" | "success" | "error";

function readSettingsSnapshot(): SettingsSnapshot {
  const cache = loadDashboardCache();

  return {
    revealBlockSize: loadRevealBlockSize(),
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
  const { revealBlockSize, connectionStatus } = useMemo(
    () => JSON.parse(settingsSnapshot) as SettingsSnapshot,
    [settingsSnapshot],
  );

  const [disconnectState, setDisconnectState] = useState<ActionState>("idle");
  const [disconnectMessage, setDisconnectMessage] = useState("");
  const [localDataState, setLocalDataState] = useState<ActionState>("idle");
  const [localDataMessage, setLocalDataMessage] = useState("");

  function setRevealSize(size: RevealBlockSize) {
    saveRevealBlockSize(size);
    notifyLocalSettingsChanged();
  }

  function clearLocalData() {
    const confirmed = window.confirm(
      "Lokale App-Daten löschen? Darstellungseinstellungen bleiben erhalten.",
    );

    if (!confirmed) {
      return;
    }

    clearParqetLocalUserData();
    setLocalDataState("success");
    setLocalDataMessage("Lokale Daten wurden gelöscht.");
  }

  async function disconnectParqet() {
    const confirmed = window.confirm(
      "Parqet-Verbindung trennen und lokal gespeicherte Portfolio- und Aktivitätsdaten löschen?",
    );

    if (!confirmed) {
      return;
    }

    setDisconnectState("loading");
    setDisconnectMessage("Parqet-Verbindung wird getrennt …");

    try {
      const response = await fetch("/api/auth/disconnect", {
        method: "POST",
      });

      if (!response.ok) {
        setDisconnectState("error");
        setDisconnectMessage("Parqet-Verbindung konnte nicht getrennt werden.");
        return;
      }

      clearParqetLocalUserData();
      setDisconnectState("success");
      setDisconnectMessage("Parqet-Verbindung wurde getrennt.");
    } catch {
      setDisconnectState("error");
      setDisconnectMessage("Parqet-Verbindung konnte nicht getrennt werden.");
    }
  }

  return (
    <main className={`app-content ${styles.page}`}>
      <section className={`ui-surface ${styles.hero}`}>
        <p className={styles.eyebrow}>AssetTrace · Einstellungen</p>
        <h1 className={styles.title}>Einstellungen</h1>
        <p className={styles.description}>
          Verwalte deine Parqet-Verbindung, Darstellung und lokale Daten auf
          diesem Gerät.
        </p>
      </section>

      <div className={styles.grid}>
        <section className={`ui-surface ${styles.card}`} aria-labelledby="connection-heading">
          <div className={styles.cardHeader}>
            <h2 id="connection-heading" className={styles.cardTitle}>
              Parqet-Verbindung
            </h2>
            <p className={styles.text}>
              Verbindungsstatus und Aktionen für dein Parqet-Konto.
            </p>
          </div>

          <div
            className={`${styles.connectionStatus} ${styles[`connection_${connectionStatus.kind}`]}`}
            aria-label="Parqet-Verbindungsstatus"
          >
            <span className={styles.connectionLabel}>{connectionStatus.label}</span>
            <span className={styles.connectionDescription}>{connectionStatus.description}</span>
          </div>

          <div className={styles.actions}>
            {connectionStatus.actionHref && connectionStatus.actionLabel ? (
              <a className="ui-btn ui-btn-secondary" href={connectionStatus.actionHref}>
                {connectionStatus.actionLabel}
              </a>
            ) : null}
            <button
              type="button"
              className="ui-btn ui-btn-secondary"
              onClick={disconnectParqet}
              disabled={disconnectState === "loading"}
            >
              Parqet-Verbindung trennen
            </button>
          </div>

          <p className={styles.meta}>
            Entfernt die Verbindung zu Parqet und löscht lokal gespeicherte
            Portfolio- und Aktivitätsdaten von diesem Gerät.
            Darstellungseinstellungen bleiben erhalten.
          </p>

          {disconnectMessage ? (
            <div
              className={
                disconnectState === "success" || disconnectState === "loading"
                  ? "ui-banner ui-banner-info"
                  : "ui-banner ui-banner-error"
              }
            >
              {disconnectMessage}
            </div>
          ) : null}
        </section>

        <section className={`ui-surface ${styles.card}`} aria-labelledby="appearance-heading">
          <div className={styles.cardHeader}>
            <h2 id="appearance-heading" className={styles.cardTitle}>
              Darstellung / UI
            </h2>
            <p className={styles.text}>
              Wähle, ob AssetTrace der Geräteeinstellung folgt oder dauerhaft
              hell bzw. dunkel angezeigt wird.
            </p>
          </div>

          <div className={styles.segmented} role="group" aria-label="Darstellungsmodus">
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
          <p className={styles.meta}>Aktiv: {resolvedTheme === "dark" ? "Dunkel" : "Hell"}.</p>

          <div className={styles.optionGroup}>
            <p className={styles.text}>Zeilen pro Schritt in Listenansichten.</p>
            <div className={styles.segmented} role="group" aria-label="Reveal-Größe">
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
            <p className={styles.meta}>Aktiv: {revealBlockSize} Zeilen pro Schritt.</p>
          </div>
        </section>

        <section className={`ui-surface ${styles.card}`} aria-labelledby="local-data-heading">
          <div className={styles.cardHeader}>
            <h2 id="local-data-heading" className={styles.cardTitle}>
              Lokale Daten
            </h2>
            <p className={styles.text}>
              Die App aktualisiert deine Parqet-Daten automatisch, wenn sie
              fehlen oder veraltet sind.
            </p>
          </div>

          <div className={styles.actions}>
            <button type="button" className="ui-btn ui-btn-secondary" onClick={clearLocalData}>
              Lokale Daten löschen
            </button>
          </div>

          <p className={styles.meta}>
            Wenn etwas nicht stimmt, kannst du lokale App-Daten löschen und die
            App neu laden lassen.
          </p>
          <p className={styles.meta}>
            Portfolio- und Aktivitätsdaten werden lokal in deinem Browser
            zwischengespeichert.
          </p>
          <p className={styles.meta}>
            Die Market-Data-Datenbank enthält allgemeine Instrument- und
            Kursdaten, keine privaten Portfolioinhalte.
          </p>

          {localDataMessage ? (
            <div
              className={
                localDataState === "success"
                  ? "ui-banner ui-banner-info"
                  : "ui-banner ui-banner-error"
              }
            >
              {localDataMessage}
            </div>
          ) : null}
        </section>

        <section className={`ui-surface ${styles.card}`} aria-labelledby="admin-hint-heading">
          <div className={styles.cardHeader}>
            <h2 id="admin-hint-heading" className={styles.cardTitle}>
              Hinweis
            </h2>
            <p className={styles.text}>
              Marktdaten und Datenqualität werden in der Admin-Konsole geprüft.
            </p>
          </div>
          <div className={styles.actions}>
            <a className="ui-btn ui-btn-secondary" href="/admin">
              Zur Admin-Konsole
            </a>
          </div>
          <p className={styles.meta}>
            Die Portfolio-Auswahl findest du oben im Header.
          </p>
        </section>
      </div>
    </main>
  );
}
