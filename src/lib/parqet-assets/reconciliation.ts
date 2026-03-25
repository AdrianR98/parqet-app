import type { ReconciliationWarning } from "../types";
import type { NormalizedActivity } from "./normalization";

/**
 * Erste Reconciliation-Regeln.
 *
 * Ziel:
 * - offensichtliche Unstimmigkeiten sichtbar machen
 * - noch nichts automatisch "wegkorrigieren"
 * - spaetere DB-gestuetzte Pruefungen vorbereiten
 */
export function buildReconciliationWarnings(
    activities: NormalizedActivity[]
): ReconciliationWarning[] {
    const warnings: ReconciliationWarning[] = [];

    const grouped = new Map<string, NormalizedActivity[]>();

    for (const activity of activities) {
        if (!grouped.has(activity.isin)) {
            grouped.set(activity.isin, []);
        }

        grouped.get(activity.isin)!.push(activity);
    }

    for (const [isin, entries] of grouped.entries()) {
        const sorted = [...entries].sort((a, b) => {
            return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
        });

        let netShares = 0;
        let boughtShares = 0;
        let soldShares = 0;

        for (const entry of sorted) {
            if (entry.type === "buy" || entry.type === "transfer_in") {
                netShares += entry.shares;
            }

            if (entry.type === "sell" || entry.type === "transfer_out") {
                netShares -= entry.shares;
            }

            if (entry.type === "buy") {
                boughtShares += entry.shares;
            }

            if (entry.type === "sell") {
                soldShares += entry.shares;
            }

            if (netShares < -0.0000001) {
                warnings.push({
                    isin,
                    message: "Verkauf oder Ausbuchung ohne ausreichenden Vorbestand.",
                    severity: "error",
                });

                break;
            }
        }

        if (soldShares > boughtShares + 0.0000001) {
            warnings.push({
                isin,
                message: "Mehr Stuecke verkauft als gekauft.",
                severity: "warning",
            });
        }

        if (sorted.some((entry) => entry.type === "unknown")) {
            warnings.push({
                isin,
                message: "Unbekannter Aktivitaetstyp in der Historie vorhanden.",
                severity: "info",
            });
        }
    }

    return warnings;
}