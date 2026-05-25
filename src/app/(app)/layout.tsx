"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import HeaderBar from "../../components/dashboard/HeaderBar";
import AppFooter from "../../components/layout/AppFooter";
import { useTheme } from "../../hooks/use-theme";
import {
    ADMIN_RETURN_PENDING_KEY,
    ADMIN_RETURN_RELOADED_FOR_KEY,
    shouldReloadAfterAdminReturn,
} from "../../lib/admin-return-restore-guard";
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

        const evaluateAdminReturnBoundary = () => {
            const currentPath = window.location.pathname;
            const pending = window.sessionStorage.getItem(ADMIN_RETURN_PENDING_KEY);
            const reloadedFor = window.sessionStorage.getItem(ADMIN_RETURN_RELOADED_FOR_KEY);
            const decision = shouldReloadAfterAdminReturn({
                pathname: currentPath,
                pending,
                reloadedFor,
            });

            if (decision.shouldReload) {
                window.sessionStorage.setItem(ADMIN_RETURN_RELOADED_FOR_KEY, currentPath);
                window.location.reload();
                return;
            }

            if (decision.shouldClearMarker) {
                window.sessionStorage.removeItem(ADMIN_RETURN_PENDING_KEY);
                window.sessionStorage.removeItem(ADMIN_RETURN_RELOADED_FOR_KEY);
            }
        };

        evaluateAdminReturnBoundary();
        const handlePageShow = () => evaluateAdminReturnBoundary();

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
