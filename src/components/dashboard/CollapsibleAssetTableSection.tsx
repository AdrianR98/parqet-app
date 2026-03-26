"use client";

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
                <div className={styles.left}>
                    <span className={styles.title}>{title}</span>
                    <span className={styles.count}>{assets.length}</span>
                    {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
                </div>

                <span className={`${styles.chevron} ${open ? styles.open : ""}`}>
                    ▾
                </span>
            </button>

            {open ? (
                <div className={styles.content}>
                    <AssetTable assets={assets} onAuditAsset={onAuditAssetAction} />
                </div>
            ) : null}
        </section>
    );
}