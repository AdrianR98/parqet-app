import { formatCurrency, getPnLClass } from "../../lib/format";
import type { DashboardStats } from "../../lib/types";
import styles from "./StatsGrid.module.css";

type StatsGridProps = {
    stats: DashboardStats;
};

type StatsCardProps = {
    label: string;
    value: string | number;
    hint: string;
    valueClassName?: string;
};

function StatsCard({
    label,
    value,
    hint,
    valueClassName = "",
}: StatsCardProps) {
    return (
        <article className={styles.card}>
            <div className={styles.label}>{label}</div>
            <div className={`${styles.value} ${valueClassName}`.trim()}>{value}</div>
            <div className={styles.hint}>{hint}</div>
        </article>
    );
}

export default function StatsGrid({ stats }: StatsGridProps) {
    const pnlClass = getPnLClass(stats.totalUnrealizedPnL);
    const pnlClassName =
        pnlClass === "positive"
            ? styles.positive
            : pnlClass === "negative"
                ? styles.negative
                : "";

    return (
        <section className={styles.grid}>
            <StatsCard
                label="Roh-Activities"
                value={stats.rawActivityCount}
                hint="Alle geladenen Eintraege vor Bereinigung"
            />

            <StatsCard
                label="Bereinigte Activities"
                value={stats.filteredActivityCount}
                hint="Nur relevante Security-Events"
            />

            <StatsCard
                label="Assets"
                value={stats.assetCount}
                hint="Nach ISIN ueber Portfolios aggregiert"
            />

            <StatsCard
                label="Dividenden netto"
                value={formatCurrency(stats.totalDividendNet)}
                hint="Summierte Netto-Dividenden"
            />

            <StatsCard
                label="Positionswert"
                value={formatCurrency(stats.totalPositionValue)}
                hint="Noch auf Basis des Preis-Fallbacks"
            />

            <StatsCard
                label="Kursgewinn"
                value={formatCurrency(stats.totalUnrealizedPnL)}
                hint="Unrealisiert, aktuell ohne externe Live-Kurse"
                valueClassName={pnlClassName}
            />
        </section>
    );
}