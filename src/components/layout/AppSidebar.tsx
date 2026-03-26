"use client";

import Link from "next/link";
import styles from "./AppSidebar.module.css";

type AppSidebarProps = {
    activeItem: "dashboard" | "activities";
};

type NavItem = {
    key: string;
    label: string;
    href?: string;
    icon: string;
    badge?: string;
};

const MAIN_ITEMS: NavItem[] = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "◫" },
    { key: "analysis", label: "Analyse", icon: "◔" },
    { key: "activities", label: "Aktivitäten", href: "/activities", icon: "↹" },
    { key: "dividends", label: "Dividenden", icon: "◌" },
    { key: "portfolios", label: "Portfolios", icon: "◎" },
    { key: "watchlists", label: "Watchlists", icon: "★" },
    { key: "news", label: "News Feed", icon: "≣" },
    { key: "markets", label: "Märkte", icon: "◍" },
    { key: "calendar", label: "Dividendenkalender", icon: "□" },
    { key: "integrations", label: "Integrationen", icon: "✣", badge: "Neu" },
    { key: "calc", label: "Finanzrechner", icon: "⌘" },
    { key: "community", label: "Community", icon: "◉" },
];

function SidebarItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
    const content = (
        <>
            <span className={styles.itemIcon} aria-hidden="true">
                {item.icon}
            </span>
            <span className={styles.itemLabel}>{item.label}</span>
            {item.badge ? <span className={styles.itemBadge}>{item.badge}</span> : null}
        </>
    );

    if (item.href) {
        return (
            <Link
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`.trim()}
                aria-current={isActive ? "page" : undefined}
            >
                {content}
            </Link>
        );
    }

    return (
        <div className={`${styles.navItem} ${styles.navItemDisabled}`.trim()} aria-disabled="true">
            {content}
        </div>
    );
}

export default function AppSidebar({ activeItem }: AppSidebarProps) {
    return (
        <aside className={styles.sidebar}>
            <div className={styles.brandBlock}>
                <div className={styles.brandRow}>
                    <div className={styles.logoMark} aria-hidden="true">
                        <span className={styles.logoTile} />
                        <span className={styles.logoTile} />
                        <span className={styles.logoTile} />
                        <span className={styles.logoTile} />
                    </div>

                    <div className={styles.brandText}>
                        <div className={styles.brandTitle}>parqet</div>
                        <div className={styles.brandSubtitle}>Asset View</div>
                    </div>
                </div>

                <div className={styles.viewBlock}>
                    <div className={styles.viewLabel}>Ansicht</div>
                    <div className={styles.viewValue}>Deine Gesamtansicht</div>
                </div>
            </div>

            <nav className={styles.nav} aria-label="Hauptnavigation">
                {MAIN_ITEMS.map((item) => (
                    <SidebarItem
                        key={item.key}
                        item={item}
                        isActive={item.key === activeItem}
                    />
                ))}
            </nav>
        </aside>
    );
}
