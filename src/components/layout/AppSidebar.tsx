"use client";

import Link from "next/link";
import styles from "./AppSidebar.module.css";

export type AppNavItemKey =
    | "dashboard"
    | "activities"
    | "timeline"
    | "reports"
    | "settings";

type AppSidebarProps = {
    activeItem: AppNavItemKey;
};

type NavItem = {
    key: AppNavItemKey;
    label: string;
    href: string;
    icon: string;
    description: string;
};

const MAIN_ITEMS: NavItem[] = [
    {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: "◫",
        description: "Portfolio-Überblick",
    },
    {
        key: "activities",
        label: "Aktivitäten",
        href: "/activities",
        icon: "↹",
        description: "Lokale Prüfung",
    },
    {
        key: "timeline",
        label: "Timeline",
        href: "/timeline",
        icon: "◷",
        description: "AssetTrace Zielbereich",
    },
    {
        key: "reports",
        label: "Reports",
        href: "/reports",
        icon: "▤",
        description: "Auswertungen vorbereiten",
    },
    {
        key: "settings",
        label: "Einstellungen",
        href: "/settings",
        icon: "⚙",
        description: "App und Verbindung",
    },
];

function SidebarItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
    return (
        <Link
            href={item.href}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`.trim()}
            aria-current={isActive ? "page" : undefined}
        >
            <span className={styles.itemIcon} aria-hidden="true">
                {item.icon}
            </span>
            <span className={styles.itemText}>
                <span className={styles.itemLabel}>{item.label}</span>
                <span className={styles.itemDescription}>{item.description}</span>
            </span>
        </Link>
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
                        <div className={styles.brandTitle}>AssetTrace</div>
                        <div className={styles.brandSubtitle}>für Parqet-Daten</div>
                    </div>
                </div>

                <div className={styles.viewBlock}>
                    <div className={styles.viewLabel}>Produktfokus</div>
                    <div className={styles.viewValue}>
                        Analyse- und Transparenzschicht für Parqet-Daten
                    </div>
                </div>
            </div>

            <nav className={styles.nav} aria-label="Hauptnavigation AssetTrace">
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
