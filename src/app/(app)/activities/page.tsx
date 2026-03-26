"use client";

import { useState } from "react";
import styles from "./ActivitiesPage.module.css";
import { useActivitiesAudit } from "../../../hooks/use-activities-audit";
import { useActivityOverrides } from "../../../hooks/use-activity-overrides";
import type {
    ActivitiesAuditItem,
    ActivityOverrideField,
    ActivityOverrideValue,
} from "../../../lib/types";
import { formatCurrency } from "../../../lib/format";

const DEBUG_ACTIVITIES_PAGE = true;

function debugLog(message: string, payload?: unknown) {
    if (!DEBUG_ACTIVITIES_PAGE) return;
    console.debug(`[activities-page] ${message}`, payload ?? "");
}

function debugError(message: string, error: unknown) {
    console.error(`[activities-page] ${message}`, error);
}

function getTypeLabel(type: ActivitiesAuditItem["type"]) {
    switch (type) {
        case "buy":
            return "Kauf";
        case "sell":
            return "Verkauf";
        case "dividend":
            return "Dividende";
        case "transfer_in":
            return "Transfer ein";
        case "transfer_out":
            return "Transfer aus";
        default:
            return "Unbekannt";
    }
}

function formatDateTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function parseOverrideValue(
    field: ActivityOverrideField,
    rawValue: string
): ActivityOverrideValue {
    if (rawValue.trim() === "") {
        return null;
    }

    if (
        field === "shares" ||
        field === "price" ||
        field === "amount" ||
        field === "amountNet"
    ) {
        const normalized = rawValue.replace(",", ".");
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : rawValue;
    }

    return rawValue;
}

function getCurrentEditableValue(
    item: ActivitiesAuditItem,
    field: ActivityOverrideField
): string {
    const overrideValue = item.overrideValues?.[field];

    if (overrideValue !== undefined && overrideValue !== null) {
        return String(overrideValue);
    }

    switch (field) {
        case "shares":
            return String(item.shares ?? "");
        case "price":
            return String(item.price ?? "");
        case "amount":
            return String(item.amount ?? "");
        case "amountNet":
            return String(item.amountNet ?? "");
        case "type":
            return String(item.type ?? "");
        default:
            return "";
    }
}

const EDITABLE_OVERRIDE_FIELDS: Array<{
    field: ActivityOverrideField;
    label: string;
    inputType: "text" | "number";
}> = [
        { field: "shares", label: "Stücke", inputType: "number" },
        { field: "price", label: "Preis", inputType: "number" },
        { field: "amount", label: "Betrag", inputType: "number" },
        { field: "amountNet", label: "Netto", inputType: "number" },
        { field: "type", label: "Typ", inputType: "text" },
    ];

type ActivityRowProps = {
    item: ActivitiesAuditItem;
    onOverrideSavedAction: () => Promise<void>;
};

function ActivityRow({ item, onOverrideSavedAction }: ActivityRowProps) {
    const { saveOverride, deleteOverride } = useActivityOverrides();

    const [editingField, setEditingField] = useState<ActivityOverrideField | null>(null);
    const [draftValue, setDraftValue] = useState("");
    const [rowSaving, setRowSaving] = useState(false);
    const [rowDeleting, setRowDeleting] = useState(false);
    const [rowError, setRowError] = useState<string | null>(null);

    function startEditing(field: ActivityOverrideField) {
        debugLog("start editing", { activityId: item.id, field });
        setEditingField(field);
        setDraftValue(getCurrentEditableValue(item, field));
        setRowError(null);
    }

    function stopEditing() {
        debugLog("stop editing", { activityId: item.id, field: editingField });
        setEditingField(null);
        setDraftValue("");
        setRowError(null);
    }

    async function handleSave(field: ActivityOverrideField) {
        setRowSaving(true);
        setRowError(null);

        try {
            const parsedValue = parseOverrideValue(field, draftValue);

            debugLog("save override", {
                activityId: item.id,
                field,
                draftValue,
                parsedValue,
            });

            await saveOverride({
                activityId: item.id,
                field,
                value: parsedValue,
            });

            await onOverrideSavedAction();
            stopEditing();
        } catch (error) {
            debugError("save override failed", error);
            setRowError(
                error instanceof Error
                    ? error.message
                    : "Override konnte nicht gespeichert werden."
            );
        } finally {
            setRowSaving(false);
        }
    }

    async function handleDelete(field: ActivityOverrideField) {
        setRowDeleting(true);
        setRowError(null);

        try {
            debugLog("delete override", {
                activityId: item.id,
                field,
            });

            await deleteOverride({
                activityId: item.id,
                field,
            });

            await onOverrideSavedAction();

            if (editingField === field) {
                stopEditing();
            }
        } catch (error) {
            debugError("delete override failed", error);
            setRowError(
                error instanceof Error
                    ? error.message
                    : "Override konnte nicht gelöscht werden."
            );
        } finally {
            setRowDeleting(false);
        }
    }

    return (
        <article className={styles.rowCard}>
            <div className={styles.rowTop}>
                <div className={styles.rowTopLeft}>
                    <span className={styles.typeBadge}>{getTypeLabel(item.type)}</span>

                    {item.hasOverrides ? (
                        <span className={styles.stateBadge}>Override aktiv</span>
                    ) : null}

                    {item.warningMessages.length > 0 ? (
                        <span className={styles.warningBadge}>
                            {item.warningMessages.length} Warnung
                            {item.warningMessages.length === 1 ? "" : "en"}
                        </span>
                    ) : null}
                </div>

                <div className={styles.rowTopRight}>{formatDateTime(item.datetime)}</div>
            </div>

            <div className={styles.assetBlock}>
                <div className={styles.assetName}>{item.name ?? item.isin}</div>
                <div className={styles.assetMeta}>
                    {item.isin}
                    {item.symbol ? ` · ${item.symbol}` : ""}
                    {item.wkn ? ` · ${item.wkn}` : ""}
                </div>
            </div>

            <div className={styles.metricsGrid}>
                <div className={styles.metricCell}>
                    <span className={styles.metricLabel}>Portfolio</span>
                    <span className={styles.metricValue}>{item.portfolioName}</span>
                </div>
                <div className={styles.metricCell}>
                    <span className={styles.metricLabel}>Stücke</span>
                    <span className={styles.metricValue}>{item.shares}</span>
                </div>
                <div className={styles.metricCell}>
                    <span className={styles.metricLabel}>Preis</span>
                    <span className={styles.metricValue}>{formatCurrency(item.price)}</span>
                </div>
                <div className={styles.metricCell}>
                    <span className={styles.metricLabel}>Betrag</span>
                    <span className={styles.metricValue}>{formatCurrency(item.amount)}</span>
                </div>
                <div className={styles.metricCell}>
                    <span className={styles.metricLabel}>Netto</span>
                    <span className={styles.metricValue}>{formatCurrency(item.amountNet)}</span>
                </div>
                <div className={styles.metricCell}>
                    <span className={styles.metricLabel}>Raw</span>
                    <span className={styles.metricValue}>{item.rawType}</span>
                </div>
            </div>

            {item.hasOverrides && item.overrideFlags ? (
                <div className={styles.overrideList}>
                    {Object.keys(item.overrideFlags).map((field) => {
                        const typedField = field as ActivityOverrideField;
                        const original =
                            item.originalValues?.[
                            field as keyof typeof item.originalValues
                            ];
                        const override = item.overrideValues?.[field];
                        const isEditing = editingField === typedField;

                        return (
                            <div key={field} className={styles.overrideRow}>
                                <span className={styles.overrideField}>{field}</span>

                                {!isEditing ? (
                                    <>
                                        <span className={styles.overrideOld}>
                                            {String(original)}
                                        </span>
                                        <span className={styles.overrideArrow}>→</span>
                                        <span className={styles.overrideNew}>
                                            {String(override)}
                                        </span>

                                        <button
                                            type="button"
                                            className="ui-btn ui-btn-ghost"
                                            onClick={() => startEditing(typedField)}
                                        >
                                            Bearbeiten
                                        </button>

                                        <button
                                            type="button"
                                            className="ui-btn ui-btn-ghost"
                                            onClick={() => handleDelete(typedField)}
                                            disabled={rowDeleting}
                                        >
                                            {rowDeleting ? "Löscht..." : "Reset"}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <input
                                            className="ui-input"
                                            type={
                                                EDITABLE_OVERRIDE_FIELDS.find(
                                                    (entry) => entry.field === typedField
                                                )?.inputType === "number"
                                                    ? "number"
                                                    : "text"
                                            }
                                            step={
                                                typedField === "shares" ||
                                                    typedField === "price" ||
                                                    typedField === "amount" ||
                                                    typedField === "amountNet"
                                                    ? "any"
                                                    : undefined
                                            }
                                            value={draftValue}
                                            onChange={(event) =>
                                                setDraftValue(event.target.value)
                                            }
                                        />

                                        <button
                                            type="button"
                                            className="ui-btn ui-btn-primary"
                                            onClick={() => handleSave(typedField)}
                                            disabled={rowSaving}
                                        >
                                            {rowSaving ? "Speichert..." : "Speichern"}
                                        </button>

                                        <button
                                            type="button"
                                            className="ui-btn ui-btn-secondary"
                                            onClick={stopEditing}
                                            disabled={rowSaving}
                                        >
                                            Abbrechen
                                        </button>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : null}

            {!item.hasOverrides ? (
                <div className={styles.quickEditRow}>
                    {EDITABLE_OVERRIDE_FIELDS.map((entry) => (
                        <button
                            key={entry.field}
                            type="button"
                            className="ui-btn ui-btn-ghost"
                            onClick={() => startEditing(entry.field)}
                        >
                            {entry.label} überschreiben
                        </button>
                    ))}
                </div>
            ) : null}

            {editingField && (!item.overrideFlags || !item.overrideFlags[editingField]) ? (
                <div className={styles.newOverrideEditor}>
                    <span className={styles.overrideField}>{editingField}</span>

                    <input
                        className="ui-input"
                        type={
                            EDITABLE_OVERRIDE_FIELDS.find(
                                (entry) => entry.field === editingField
                            )?.inputType === "number"
                                ? "number"
                                : "text"
                        }
                        step={
                            editingField === "shares" ||
                                editingField === "price" ||
                                editingField === "amount" ||
                                editingField === "amountNet"
                                ? "any"
                                : undefined
                        }
                        value={draftValue}
                        onChange={(event) => setDraftValue(event.target.value)}
                    />

                    <button
                        type="button"
                        className="ui-btn ui-btn-primary"
                        onClick={() => handleSave(editingField)}
                        disabled={rowSaving}
                    >
                        {rowSaving ? "Speichert..." : "Speichern"}
                    </button>

                    <button
                        type="button"
                        className="ui-btn ui-btn-secondary"
                        onClick={stopEditing}
                        disabled={rowSaving}
                    >
                        Abbrechen
                    </button>
                </div>
            ) : null}

            {rowError ? <div className={styles.inlineError}>{rowError}</div> : null}

            {item.warningMessages.length > 0 ? (
                <div className={styles.warningList}>
                    {item.warningMessages.map((warning, index) => (
                        <div key={`${item.id}-${index}`} className={styles.warningItem}>
                            {warning}
                        </div>
                    ))}
                </div>
            ) : null}
        </article>
    );
}

export default function ActivitiesPage() {
    const {
        portfolios,
        filteredItems,
        filteredSummary,
        reconciliationWarnings,
        generatedAt,
        loading,
        errorMessage,
        authRequired,
        startReconnect,
        selectedPortfolioIds,
        searchTerm,
        showPortfolioMenu,
        selectedPortfolioLabel,
        groupedYears,
        setSearchTerm,
        setShowPortfolioMenu,
        togglePortfolio,
        clearFilters,
        reload,
    } = useActivitiesAudit();

    return (
        <div className={styles.page}>
            <section className={`ui-surface ${styles.heroCard}`}>
                <div className={styles.heroTop}>
                    <div>
                        <div className={styles.pageEyebrow}>Ansicht</div>
                        <h1 className={styles.pageTitle}>Aktivitäten</h1>

                        <div className={styles.kpiLine}>
                            <span>{filteredSummary.buyCount} Käufe</span>
                            <span>·</span>
                            <span>{filteredSummary.sellCount} Verkäufe</span>
                            <span>·</span>
                            <span>{filteredSummary.dividendCount} Dividenden</span>
                        </div>

                        <div className={styles.metaLine}>
                            <span>{filteredItems.length} Einträge</span>
                            <span>·</span>
                            <span>{reconciliationWarnings.length} Warnungen</span>
                            {generatedAt ? (
                                <>
                                    <span>·</span>
                                    <span>{formatDateTime(generatedAt)}</span>
                                </>
                            ) : null}
                        </div>
                    </div>

                    <div className={styles.heroActions}>
                        <button type="button" className="ui-btn ui-btn-secondary" onClick={reload}>
                            Neu laden
                        </button>
                        <button type="button" className="ui-btn ui-btn-primary">
                            Neue Aktivität
                        </button>
                    </div>
                </div>

                <div className={styles.filtersRow}>
                    <div className={styles.dropdown}>
                        <button
                            type="button"
                            className="ui-filter-btn"
                            onClick={() => setShowPortfolioMenu((current) => !current)}
                        >
                            <span>{selectedPortfolioLabel}</span>
                            <span>▾</span>
                        </button>

                        {showPortfolioMenu ? (
                            <div className={styles.dropdownMenu}>
                                {portfolios.map((portfolio) => (
                                    <label key={portfolio.id} className={styles.dropdownItem}>
                                        <input
                                            type="checkbox"
                                            checked={selectedPortfolioIds.includes(portfolio.id)}
                                            onChange={() => togglePortfolio(portfolio.id)}
                                        />
                                        <span>{portfolio.name}</span>
                                    </label>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <input
                        className="ui-input"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Name, WKN, ISIN, Symbol oder Portfolio suchen"
                    />

                    <button
                        type="button"
                        className="ui-btn ui-btn-secondary"
                        onClick={clearFilters}
                    >
                        Reset
                    </button>
                </div>
            </section>

            {errorMessage ? (
                <div className={styles.errorBanner}>
                    <strong>{authRequired ? "Verbindung abgelaufen" : "Fehler"}</strong>
                    <div>{errorMessage}</div>

                    {authRequired ? (
                        <div className={styles.errorActions}>
                            <button
                                type="button"
                                className="ui-btn ui-btn-secondary"
                                onClick={startReconnect}
                            >
                                Neu verbinden
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {loading ? (
                <div className={styles.infoBanner}>Aktivitäten werden geladen...</div>
            ) : null}

            <section className={styles.content}>
                {groupedYears.map((yearGroup) => (
                    <div key={yearGroup.year} className={styles.yearSection}>
                        <div className={styles.yearHeader}>
                            <h2 className={styles.yearTitle}>{yearGroup.year}</h2>
                            <div className={styles.yearMeta}>
                                {yearGroup.items.length} Aktivitäten
                            </div>
                        </div>

                        {yearGroup.months.map((monthGroup) => (
                            <div key={monthGroup.monthKey} className={styles.monthSection}>
                                <div className={styles.monthHeader}>
                                    <h3 className={styles.monthTitle}>{monthGroup.monthLabel}</h3>
                                    <div className={styles.monthMeta}>
                                        {monthGroup.items.length} Aktivitäten
                                    </div>
                                </div>

                                <div className={`ui-surface ${styles.monthCard}`}>
                                    {monthGroup.items.map((item) => (
                                        <ActivityRow
                                            key={item.id}
                                            item={item}
                                            onOverrideSavedAction={reload}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                {!loading && groupedYears.length === 0 ? (
                    <div className={`ui-surface ${styles.emptyState}`}>
                        Keine Aktivitäten gefunden.
                    </div>
                ) : null}
            </section>
        </div>
    );
}