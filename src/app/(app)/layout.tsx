"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import AppSidebar, { type AppNavItemKey } from "../../components/layout/AppSidebar";
import HeaderBar from "../../components/dashboard/HeaderBar";
import { useTheme } from "../../hooks/use-theme";
import styles from "./layout.module.css";

function getActiveView(pathname: string): AppNavItemKey {
    if (pathname.startsWith("/activities")) return "activities";
    if (pathname.startsWith("/timeline")) return "timeline";
    if (pathname.startsWith("/reports")) return "reports";
    if (pathname.startsWith("/settings")) return "settings";

    return "dashboard";
}

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { appearanceMode, theme, toggleTheme, themeStyle } = useTheme();

    const activeView = useMemo(() => getActiveView(pathname), [pathname]);

    return (
        <div className={styles.app} style={themeStyle}>
            <AppSidebar activeItem={activeView} />

            <div className={styles.main}>
                <HeaderBar
                    theme={theme}
                    appearanceMode={appearanceMode}
                    activeView={activeView}
                    onToggleThemeAction={toggleTheme}
                />

                <div className={styles.content}>{children}</div>
            </div>
        </div>
    );
}
