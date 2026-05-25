"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import HeaderBar from "../../components/dashboard/HeaderBar";
import AppFooter from "../../components/layout/AppFooter";
import { useTheme } from "../../hooks/use-theme";
import styles from "./layout.module.css";

export type TopNavKey = "overview" | "activities" | "settings";

function getActiveView(pathname: string): TopNavKey {
    if (pathname.startsWith("/activities")) return "activities";
    if (pathname.startsWith("/settings")) return "settings";
    return "overview";
}

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { theme, toggleTheme, themeStyle } = useTheme();

    const activeView = useMemo(() => getActiveView(pathname), [pathname]);

    return (
        <div className={styles.app} style={themeStyle}>
            <div className={styles.main}>
                <HeaderBar
                    theme={theme}
                    activeView={activeView}
                    onToggleThemeAction={toggleTheme}
                />

                <div className={styles.content}>{children}</div>
                <AppFooter />
            </div>
        </div>
    );
}
