import { useState } from "react";
import type { AssetSummary } from "../../lib/types";
import AssetTable from "./AssetTable";
import styles from "./CollapsibleAssetTableSection.module.css";

type Props = {
    title: string;
    subtitle?: string;
    assets: AssetSummary[];
    loading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    defaultExpanded?: boolean;
};

export default function CollapsibleAssetTableSection({
    title,
    subtitle,
    assets,
    loading = false,
    emptyTitle,
    emptyDescription,
    defaultExpanded = true,
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
                        <span className={styles.count}>{loading ? "Lädt" : assets.length}</span>
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
                    <AssetTable
                        assets={assets}
                        loading={loading}
                        emptyTitle={emptyTitle}
                        emptyDescription={emptyDescription}
                    />
                </div>
            ) : null}
        </section>
    );
}
