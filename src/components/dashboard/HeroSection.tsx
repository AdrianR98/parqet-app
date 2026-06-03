import { useMemo, useState } from "react";
import styles from "./HeroSection.module.css";
import { formatCurrency } from "../../lib/format";

export type AllocationSegment = {
    label: string;
    value: number;
    color: string;
};

type HeroSectionProps = {
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    totalPositionValue?: number;
    totalUnrealizedPnL?: number;
    totalInvestedCapital?: number;
    totalDividendNet?: number;
    allocationSegments: AllocationSegment[];
};

type DonutSegment = AllocationSegment & {
    ratio: number;
    dashLength: number;
    visibleDashLength: number;
    dashOffset: number;
};

const DONUT_RADIUS = 38;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_SEGMENT_GAP = 1.4;

function buildDonutSegments(segments: AllocationSegment[]): DonutSegment[] {
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    if (total <= 0) {
        return [];
    }

    let offset = 0;
    return segments.map((segment) => {
        const ratio = segment.value / total;
        const dashLength = ratio * DONUT_CIRCUMFERENCE;
        const result: DonutSegment = {
            ...segment,
            ratio,
            dashLength,
            visibleDashLength: Math.max(dashLength - DONUT_SEGMENT_GAP, 0),
            dashOffset: -offset,
        };
        offset += dashLength;
        return result;
    });
}

export default function HeroSection({
    searchQuery,
    onSearchQueryChange,
    totalPositionValue,
    totalUnrealizedPnL,
    totalInvestedCapital,
    totalDividendNet,
    allocationSegments,
}: HeroSectionProps) {
    const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null);
    const donutSegments = useMemo(
        () => buildDonutSegments(allocationSegments),
        [allocationSegments],
    );
    const hoveredSegment = hoveredSegmentIndex != null ? donutSegments[hoveredSegmentIndex] : null;

    return (
        <section className={`ui-surface ${styles.hero}`}>
            <div className={styles.topRow}>
                <input
                    className={`ui-input ${styles.search}`}
                    type="search"
                    placeholder="Suche nach Wertpapieren, ETFs, Kryptowährungen …"
                    aria-label="Globale Suche"
                    value={searchQuery}
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                />
            </div>

            <div className={styles.summary}>
                <div className={styles.donutWrap}>
                    {donutSegments.length > 0 ? (
                        <div className={styles.donutChart}>
                            <svg viewBox="0 0 96 96" className={styles.donutSvg} role="img" aria-label="Allokation aktiver Wertpapiere">
                                <circle
                                    cx="48"
                                    cy="48"
                                    r={DONUT_RADIUS}
                                    fill="none"
                                    stroke="rgba(214, 226, 239, 0.9)"
                                    strokeWidth="14"
                                />
                                {donutSegments.map((segment, index) => (
                                    <circle
                                        key={segment.label}
                                        className={styles.donutSegment}
                                        cx="48"
                                        cy="48"
                                        r={DONUT_RADIUS}
                                        fill="none"
                                        stroke={segment.color}
                                        strokeWidth="14"
                                        strokeDasharray={`${segment.visibleDashLength} ${DONUT_CIRCUMFERENCE}`}
                                        strokeDashoffset={segment.dashOffset}
                                        transform="rotate(-90 48 48)"
                                        strokeLinecap="butt"
                                        tabIndex={0}
                                        role="presentation"
                                        aria-label={`${segment.label} ${(segment.ratio * 100).toFixed(1)} Prozent`}
                                        onMouseEnter={() => setHoveredSegmentIndex(index)}
                                        onMouseLeave={() => setHoveredSegmentIndex(null)}
                                        onFocus={() => setHoveredSegmentIndex(index)}
                                        onBlur={() => setHoveredSegmentIndex(null)}
                                    >
                                        <title>{`${segment.label}: ${(segment.ratio * 100).toFixed(1)}%`}</title>
                                    </circle>
                                ))}
                            </svg>
                            <div className={styles.donutCenter}>
                                {hoveredSegment ? (
                                    <strong className={styles.centerValue}>{formatCurrency(hoveredSegment.value)}</strong>
                                ) : <i aria-hidden="true" className={styles.centerIdleDot} />}
                            </div>
                            {hoveredSegment ? (
                                <div className={styles.donutTooltip}>
                                    <strong>{hoveredSegment.label}</strong>
                                    <span>{(hoveredSegment.ratio * 100).toFixed(1)}% · {formatCurrency(hoveredSegment.value)}</span>
                                </div>
                            ) : null}
                        </div>
                    ) : <div className={styles.donutEmpty}>Keine Allokationsdaten</div>}
                </div>
                <div className={styles.kpiGrid}>
                    <div className={styles.kpiCard}><span>Portfoliowert</span><strong>{formatCurrency(totalPositionValue ?? 0)}</strong></div>
                    <div className={styles.kpiCard}><span>Gewinn / Verlust</span><strong className={(totalUnrealizedPnL ?? 0) >= 0 ? styles.positive : styles.negative}>{formatCurrency(totalUnrealizedPnL ?? 0)}</strong></div>
                    <div className={styles.kpiCard}><span>Investiert</span><strong>{formatCurrency(totalInvestedCapital ?? 0)}</strong></div>
                    <div className={styles.kpiCard}><span>Dividenden</span><strong>{formatCurrency(totalDividendNet ?? 0)}</strong></div>
                </div>
            </div>
        </section>
    );
}
