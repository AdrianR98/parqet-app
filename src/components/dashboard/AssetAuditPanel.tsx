"use client";

import { useMemo, useState } from "react";
import styles from "./AssetAuditPanel.module.css";
import type {
    ActivitiesAuditApiResponse,
    ActivitiesAuditItem,
    ActivityOverrideField,
    AssetSummary,
    SaveActivityOverrideApiResponse,
} from "../../lib/types";
import { formatCurrency } from "../../lib/format";

type AssetAuditPanelProps = {
    asset: AssetSummary | null;
    data: ActivitiesAuditApiResponse | null;
    loading: boolean;
    error: string | null;
    authRequired?: boolean;
    isOpen: boolean;
    onCloseAction: () => void;
    onReconnectAction?: () => void;
    onOverridesSavedAction?: () => Promise<void> | void;
};

const EDITABLE_FIELDS: Array<{
    field: ActivityOverrideField;
    label: string;
    inputType: "text" | "number" | "datetime-local" | "select";
    selectOptions?: Array<{ value: string; label: string }>;
}> = [
        {
            field: "type",
            label: "Typ",
            inputType: "select",
            selectOptions: [
                { value: "buy", label: "buy" },
                { value: "sell", label: "sell" },
                { value: "dividend", label: "dividend" },
                { value: "transfer_in", label: "transfer_in" },
                { value: "transfer_out", label: "transfer_out" },
                { value: "unknown", label: "unknown" },
            ],
        },
        { field: "datetime", label: "Datum/Zeit", inputType: "datetime-local" },
        { field: "shares", label: "Stücke", inputType: "number" },
        { field: "price", label: "Preis", inputType: "number" },
        { field: "amount", label: "Betrag", inputType: "number" },
        { field: "amountNet", label: "Netto", inputType: "number" },
    ];

function getFieldValue(item: ActivitiesAuditItem, field: ActivityOverrideField): string {
    switch (field) {
        case "type":
            return item.type ?? "";
        case "datetime":
            return item.datetime ? item.datetime.slice(0, 16) : "";
        case "shares":
            return String(item.shares ?? "");
        case "price":
            return String(item.price ?? "");
        case "amount":
            return String(item.amount ?? "");
        case "amountNet":
            return String(item.amountNet ?? "");
        default:
            return "";
    }
}

function formatAuditType(value: string) {
    return value.replaceAll("_", " ");
}

function formatDateTime(value: string) {
    if (!value) {
        return "-";
    }

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

function getSeverityClass(severity: "info" | "warning" | "error") {
    if (severity === "error") {
        return styles.warningSeverityError;
    }

    if (severity === "warning") {
        return styles.warningSeverityWarning;
    }

    return styles.warningSeverityInfo;
}

type ActivityEditFormProps = {
    item: ActivitiesAuditItem;
    onSavedAction?: () => Promise<void> | void;
};

function ActivityEditForm({ item, onSavedAction }: ActivityEditFormProps) {
    const [activeField, setActiveField] = useState<ActivityOverrideField>("shares");
    const [draftValue, setDraftValue] = useState<string>(getFieldValue(item, "shares"));
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const activeConfig = useMemo(
        () => EDITABLE_FIELDS.find((entry) => entry.field === activeField) ?? EDITABLE_FIELDS[0],
        [activeField]
    );

    async function handleSave() {
        setSaving(true);
        setSaveError(null);

        try {
            const response = await fetch("/api/parqet/activity-overrides", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    activityId: item.id,
                    field: activeField,
                    value: activeConfig.inputType === "number" ? Number(draftValue) : draftValue,
                    reason: reason.trim() || null,
                }),
            });

            const json = (await response.json()) as SaveActivityOverrideApiResponse;

            if (!response.ok || !json.ok) {
                throw new Error(json.message || "Override could not be saved.");
            }

            setReason("");

            if (onSavedAction) {
                await onSavedAction();
            }
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    }

    function handleFieldChange(nextField: ActivityOverrideField) {
        setActiveField(nextField);
        setDraftValue(getFieldValue(item, nextField));
        setSaveError(null);
    }

    return (
        <div className={styles.editCard}>
            <div className={styles.editHeaderRow}>
                <strong>Override setzen</strong>
                {item.hasOverrides ? (
                    <span className={styles.overrideBadge}>
                        {item.overrideCount ?? 0} Override(s)
                    </span>
                ) : null}
            </div>

            <div className={styles.editGrid}>
                <label className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Feld</span>
                    <select
                        className={styles.fieldInput}
                        value={activeField}
                        onChange={(event) =>
                            handleFieldChange(event.target.value as ActivityOverrideField)
                        }
                    >
                        {EDITABLE_FIELDS.map((field) => (
                            <option key={field.field} value={field.field}>
                                {field.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Wert</span>

                    {activeConfig.inputType === "select" ? (
                        <select
                            className={styles.fieldInput}
                            value={draftValue}
                            onChange={(event) => setDraftValue(event.target.value)}
                        >
                            {activeConfig.selectOptions?.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            className={styles.fieldInput}
                            type={activeConfig.inputType}
                            step={activeConfig.inputType === "number" ? "any" : undefined}
                            value={draftValue}
                            onChange={(event) => setDraftValue(event.target.value)}
                        />
                    )}
                </label>

                <label className={`${styles.fieldGroup} ${styles.reasonField}`}>
                    <span className={styles.fieldLabel}>Grund</span>
                    <input
                        className={styles.fieldInput}
                        type="text"
                        placeholder="Optionaler Kommentar zur Korrektur"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                    />
                </label>
            </div>

            {saveError ? <div className={styles.inlineError}>{saveError}</div> : null}

            <div className={styles.editActions}>
                <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                        setDraftValue(getFieldValue(item, activeField));
                        setReason("");
                        setSaveError(null);
                    }}
                >
                    Zurücksetzen
                </button>

                <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? "Speichert..." : "Override speichern"}
                </button>
            </div>
        </div>
    );
}

export default function AssetAuditPanel({
    asset,
    data,
    loading,
    error,
    authRequired = false,
    isOpen,
    onCloseAction,
    onReconnectAction,
    onOverridesSavedAction,
}: AssetAuditPanelProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <aside className={styles.overlay}>
            <div className={styles.panel}>
                <div className={styles.header}>
                    <div>
                        <div className={styles.eyebrow}>Asset Audit</div>
                        <h2 className={styles.title}>
                            {asset?.name ?? asset?.isin ?? "Unknown Asset"}
                        </h2>
                        <div className={styles.metaRow}>
                            <span>ISIN: {asset?.isin ?? "-"}</span>
                            <span>Symbol: {asset?.symbol ?? "-"}</span>
                            <span>Aktivitäten: {data?.summary.total ?? 0}</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onCloseAction}
                        className={styles.closeButton}
                    >
                        Schließen
                    </button>
                </div>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Asset Snapshot</h3>

                    <div className={styles.kpiGrid}>
                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Net Shares</span>
                            <strong>{asset?.netShares ?? 0}</strong>
                        </div>

                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Remaining Cost Basis</span>
                            <strong>{formatCurrency(asset?.remainingCostBasis ?? 0)}</strong>
                        </div>

                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Position Value</span>
                            <strong>{formatCurrency(asset?.positionValue ?? 0)}</strong>
                        </div>

                        <div className={styles.kpiCard}>
                            <span className={styles.kpiLabel}>Dividends</span>
                            <strong>{formatCurrency(asset?.totalDividendNet ?? 0)}</strong>
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Reconciliation Warnings</h3>

                    {loading ? <div className={styles.placeholder}>Lade Audit-Daten...</div> : null}
                    {error ? (
                        <div className={styles.errorBox}>
                            <div>{error}</div>

                            {authRequired && onReconnectAction ? (
                                <div className={styles.inlineActions}>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={onReconnectAction}
                                    >
                                        Erneut verbinden
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {!loading && !error && (data?.reconciliationWarnings?.length ?? 0) === 0 ? (
                        <div className={styles.placeholder}>Keine Warnings für dieses Asset.</div>
                    ) : null}

                    {!loading &&
                        !error &&
                        data?.reconciliationWarnings?.map((warning, index) => (
                            <div key={`${warning.isin}-${index}`} className={styles.warningCard}>
                                <div
                                    className={`${styles.warningSeverity} ${getSeverityClass(
                                        warning.severity
                                    )}`}
                                >
                                    {warning.severity.toUpperCase()}
                                </div>
                                <div>{warning.message}</div>
                            </div>
                        ))}
                </section>

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Activities</h3>

                    <div className={styles.summaryRow}>
                        <span>Total: {data?.summary.total ?? 0}</span>
                        <span>Buy: {data?.summary.buyCount ?? 0}</span>
                        <span>Sell: {data?.summary.sellCount ?? 0}</span>
                        <span>Dividend: {data?.summary.dividendCount ?? 0}</span>
                        <span>Unknown: {data?.summary.unknownCount ?? 0}</span>
                    </div>

                    <div className={styles.activityList}>
                        {loading ? <div className={styles.placeholder}>Lade Activities...</div> : null}

                        {!loading && !error && (data?.items.length ?? 0) === 0 ? (
                            <div className={styles.placeholder}>
                                Keine Activities für dieses Asset gefunden.
                            </div>
                        ) : null}

                        {!loading &&
                            !error &&
                            data?.items.map((item) => (
                                <article key={item.id} className={styles.activityCard}>
                                    <div className={styles.activityTopRow}>
                                        <div className={styles.activityIdentity}>
                                            <strong>{formatAuditType(item.type)}</strong>
                                            {item.hasOverrides ? (
                                                <span className={styles.overrideBadge}>
                                                    Override aktiv
                                                </span>
                                            ) : null}
                                        </div>

                                        <span>{formatDateTime(item.datetime)}</span>
                                    </div>

                                    <div className={styles.activityGrid}>
                                        <span>Portfolio: {item.portfolioName}</span>
                                        <span>Shares: {item.shares}</span>
                                        <span>Price: {formatCurrency(item.price)}</span>
                                        <span>Amount: {formatCurrency(item.amount)}</span>
                                        <span>Amount Net: {formatCurrency(item.amountNet)}</span>
                                        <span>Raw Type: {item.rawType}</span>
                                    </div>

                                    {item.hasOverrides && item.overrideFlags ? (
                                        <div className={styles.overrideFieldRow}>
                                            {Object.keys(item.overrideFlags).map((field) => (
                                                <span key={field} className={styles.overrideFieldBadge}>
                                                    {field}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}

                                    <ActivityEditForm
                                        item={item}
                                        onSavedAction={onOverridesSavedAction}
                                    />
                                </article>
                            ))}
                    </div>
                </section>
            </div>
        </aside>
    );
}