"use client";

import { useEffect, useMemo } from "react";
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
    const { theme, toggleTheme } = useTheme();

    const activeView = useMemo(() => getActiveView(pathname), [pathname]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const handlePageShow = (event: PageTransitionEvent) => {
            if (!event.persisted) {
                return;
            }

            // BFCache restore from /admin occasionally returns a stale/non-interactive
            // settings subtree. A targeted reload restores full interactivity and
            // rehydrates persisted appearance mode from localStorage.
            if (pathname.startsWith("/settings")) {
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
