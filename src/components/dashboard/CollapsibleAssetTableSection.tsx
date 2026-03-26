import { useState } from "react";
import type { AssetSummary } from "../../lib/types";
import AssetTable from "./AssetTable";
import styles from "./CollapsibleAssetTableSection.module.css";

type Props = {
    title: string;
    subtitle?: string;
    assets: AssetSummary[];
    defaultExpanded?: boolean;
    onAuditAssetAction?: (asset: AssetSummary) => void | Promise<void>;
};

/**
 * ============================================================
 * COMPONENT: COLLAPSIBLE ASSET TABLE SECTION
 * ============================================================
 *
 * Wichtiger Hinweis:
 * - kein "use client" mehr auf Modulebene
 * - Komponente wird innerhalb einer Client-Seite genutzt
 * - der lokale State bleibt dadurch zulässig, weil sie im Client-Baum liegt
 *
 * Falls dein Setup hier dennoch auf "use client" besteht, geben wir nur
 * diese Datei wieder als Client-Datei zurück. Erstmal aber so testen.
 */
export default function CollapsibleAssetTableSection({
    title,
    subtitle,
    assets,
    defaultExpanded = true,
    onAuditAssetAction,
}: Props) {
    const [open, setOpen] = useState(defaultExpanded);

    return (
        <section className={styles.section}>
            <button
                type="button"
                className={styles.header}
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
            >
                <div className={styles.headerLeft}>
                    <div className={styles.titleRow}>
                        <h2 className={styles.title}>{title}</h2>
                        <span className={styles.count}>{assets.length}</span>
                    </div>

                    {subtitle ? (
                        <div className={styles.subtitle}>{subtitle}</div>
                    ) : null}
                </div>

                <span className={`${styles.chevron} ${open ? styles.open : ""}`}>
                    ▾
                </span>
            </button>

            {open ? (
                <div className={styles.content}>
                    <AssetTable assets={assets} onAuditAssetAction={onAuditAssetAction} />
                </div>
            ) : null}
        </section>
    );
}