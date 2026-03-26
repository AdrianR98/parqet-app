"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import AppSidebar from "../../components/layout/AppSidebar";
import HeaderBar from "../../components/dashboard/HeaderBar";
import { useTheme } from "../../hooks/use-theme";
import styles from "./layout.module.css";

function getActiveView(pathname: string): "dashboard" | "activities" {
    if (pathname.startsWith("/activities")) {
        return "activities";
    }

    return "dashboard";
}

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();

    const activeView = useMemo(() => getActiveView(pathname), [pathname]);

    return (
        <div className={styles.app}>
            <AppSidebar activeItem={activeView} />

            <div className={styles.main}>
                <HeaderBar theme={theme} onToggleThemeAction={toggleTheme} />

                <div className={styles.content}>{children}</div>
            </div>
        </div>
    );
}