"use client";

import { useEffect } from "react";
import {
    ADMIN_RETURN_PENDING_KEY,
    ADMIN_RETURN_RELOADED_FOR_KEY,
    shouldReloadAfterAdminReturn,
} from "../../lib/admin-return-restore-guard";

function evaluateAdminReturnBoundary() {
    const currentPath = window.location.pathname;
    const pending = window.sessionStorage.getItem(ADMIN_RETURN_PENDING_KEY);
    const reloadedFor = window.sessionStorage.getItem(ADMIN_RETURN_RELOADED_FOR_KEY);
    const decision = shouldReloadAfterAdminReturn({
        pathname: currentPath,
        pending,
        reloadedFor,
    });

    if (process.env.NODE_ENV !== "production") {
        console.debug("[admin-return-restore] check", {
            pathname: currentPath,
            pending,
            reloadedFor,
            shouldReload: decision.shouldReload,
        });
    }

    if (decision.shouldReload) {
        window.sessionStorage.setItem(ADMIN_RETURN_RELOADED_FOR_KEY, currentPath);
        window.location.reload();
        return;
    }

    if (decision.shouldClearMarker) {
        window.sessionStorage.removeItem(ADMIN_RETURN_PENDING_KEY);
        window.sessionStorage.removeItem(ADMIN_RETURN_RELOADED_FOR_KEY);
    }
}

export default function AdminReturnRestoreGuard() {
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        if (process.env.NODE_ENV !== "production") {
            console.debug("[admin-return-restore] mounted");
        }

        evaluateAdminReturnBoundary();

        const handlePopState = () => {
            window.setTimeout(() => evaluateAdminReturnBoundary(), 0);
        };

        const handlePageShow = () => evaluateAdminReturnBoundary();
        const handleFocus = () => evaluateAdminReturnBoundary();
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                evaluateAdminReturnBoundary();
            }
        };

        window.addEventListener("popstate", handlePopState);
        window.addEventListener("pageshow", handlePageShow);
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("popstate", handlePopState);
            window.removeEventListener("pageshow", handlePageShow);
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return null;
}
