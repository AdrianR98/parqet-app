"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import HeaderBar from "../../components/dashboard/HeaderBar";
import AppFooter from "../../components/layout/AppFooter";
import { useTheme } from "../../hooks/use-theme";
import {
    LAST_ROUTE_KEY,
    SETTINGS_ADMIN_RETURN_RELOADED_KEY,
    VISITED_ADMIN_ROUTE_KEY,
    shouldReloadSettingsAfterAdminReturn,
} from "../../lib/settings-restore-guard";
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
    const { theme, toggleTheme } = useTheme();

    const activeView = useMemo(() => getActiveView(pathname), [pathname]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const lastRoute = window.sessionStorage.getItem(LAST_ROUTE_KEY);
        const visitedAdmin = window.sessionStorage.getItem(VISITED_ADMIN_ROUTE_KEY);
        const alreadyReloaded = window.sessionStorage.getItem(
            SETTINGS_ADMIN_RETURN_RELOADED_KEY,
        );

        if (
            shouldReloadSettingsAfterAdminReturn({
                pathname,
                lastRoute,
                visitedAdmin,
                alreadyReloaded,
            })
        ) {
            window.sessionStorage.setItem(SETTINGS_ADMIN_RETURN_RELOADED_KEY, "1");
            window.sessionStorage.setItem(LAST_ROUTE_KEY, pathname);
            window.sessionStorage.removeItem(VISITED_ADMIN_ROUTE_KEY);
            window.location.reload();
            return;
        }

        if (pathname.startsWith("/settings")) {
            if (alreadyReloaded === "1") {
                window.sessionStorage.removeItem(SETTINGS_ADMIN_RETURN_RELOADED_KEY);
            }
            window.sessionStorage.removeItem(VISITED_ADMIN_ROUTE_KEY);
        } else {
            window.sessionStorage.removeItem(SETTINGS_ADMIN_RETURN_RELOADED_KEY);
        }

        window.sessionStorage.setItem(LAST_ROUTE_KEY, pathname);

        const handlePageShow = () => {
            if (
                shouldReloadSettingsAfterAdminReturn({
                    pathname,
                    lastRoute: window.sessionStorage.getItem(LAST_ROUTE_KEY),
                    visitedAdmin: window.sessionStorage.getItem(VISITED_ADMIN_ROUTE_KEY),
                    alreadyReloaded: window.sessionStorage.getItem(
                        SETTINGS_ADMIN_RETURN_RELOADED_KEY,
                    ),
                })
            ) {
                window.sessionStorage.setItem(SETTINGS_ADMIN_RETURN_RELOADED_KEY, "1");
                window.sessionStorage.setItem(LAST_ROUTE_KEY, pathname);
                window.sessionStorage.removeItem(VISITED_ADMIN_ROUTE_KEY);
                window.location.reload();
            }
        };

        window.addEventListener("pageshow", handlePageShow);
        return () => window.removeEventListener("pageshow", handlePageShow);
    }, [pathname]);

    return (
        <div className={styles.app}>
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
