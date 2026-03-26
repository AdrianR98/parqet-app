"use client";

import styles from "./StatsGrid.module.css";
import type { DashboardStats } from "../../lib/types";
import { formatCurrency } from "../../lib/format";

type StatsGridProps = {
    stats: DashboardStats;
};

/**
 * ============================================================
 * COMPONENT: STATS GRID
 * ============================================================
 *
 * Rolle:
 * - verdichtete KPI-Ansicht unterhalb des Hero-Bereichs
 * - nutzt globale ui-surface Basis
 * - lokales CSS nur für Grid / Typografie
 *
 * Typische Erweiterungspunkte:
 * - weitere KPI-Karten
 * - kleine Trend-Indikatoren
 * - klickbare Drilldowns
 */
export default function StatsGrid({ stats }: StatsGridProps) {
    const cards = [
        {
            label: "Rohaktivitäten",
            value: String(stats.rawActivityCount),
        },
        {
            label: "Gefilterte Aktivitäten",
            value: String(stats.filteredActivityCount),
        },
        {
            label: "Aktive Assets",
            value: String(stats.activeAssetCount),
        },
        {
            label: "Geschlossene Assets",
            value: String(stats.closedAssetCount),
        },
        {
            label: "Gesamtpositionen",
            value: String(stats.assetCount),
        },
        {
            label: "Dividenden netto",
            value: formatCurrency(stats.totalDividendNet),
        },
    ];

    return (
        <section className={styles.grid}>
            {cards.map((card) => (
                <div key={card.label} className={`ui-surface ${styles.card}`}>
                    <span className={styles.label}>{card.label}</span>
                    <strong className={styles.value}>{card.value}</strong>
                </div>
            ))}
        </section>
    );
}