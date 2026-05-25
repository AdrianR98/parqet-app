"use client";

import type { AccessControlProvider, AuthProvider, CanParams } from "@refinedev/core";
import { isWritePermission, type AdminSessionPayload } from "@/lib/admin/session";

export const disabledAdminSession: AdminSessionPayload = {
    authenticated: false,
    admin: false,
    readonly: true,
    roles: [],
    permissions: [],
    reason: "disabled",
};

async function readAdminSession(): Promise<AdminSessionPayload> {
    try {
        const response = await fetch("/api/admin/session", {
            method: "GET",
            cache: "no-store",
        });

        if (!response.ok) {
            return disabledAdminSession;
        }

        const payload = (await response.json()) as Partial<AdminSessionPayload>;

        if (!payload || typeof payload !== "object") {
            return disabledAdminSession;
        }

        return {
            authenticated: payload.authenticated === true,
            admin: payload.admin === true,
            readonly: true,
            roles: Array.isArray(payload.roles) ? payload.roles.filter((role): role is string => typeof role === "string") : [],
            permissions: Array.isArray(payload.permissions)
                ? payload.permissions.filter((permission): permission is string => typeof permission === "string")
                : [],
            reason: payload.reason === "enabled_readonly" ? "enabled_readonly" : "disabled",
        };
    } catch {
        return disabledAdminSession;
    }
}

export const adminAuthProvider: Pick<AuthProvider, "check" | "login" | "logout" | "onError"> = {
    async check() {
        const session = await readAdminSession();

        if (!session.admin) {
            return {
                authenticated: false,
                redirectTo: "/admin?status=disabled",
                logout: false,
            };
        }

        return {
            authenticated: true,
        };
    },
    async login() {
        return { success: false, error: new Error("Admin login is not enabled.") };
    },
    async logout() {
        return { success: true, redirectTo: "/admin" };
    },
    async onError() {
        return {};
    },
};

export const adminAccessControlProvider: AccessControlProvider = {
    async can(params: CanParams) {
        const session = await readAdminSession();

        if (!session.admin) {
            return {
                can: false,
                reason: "disabled",
            };
        }

        const action = params.action.toLowerCase();
        if (isWritePermission(action)) {
            return {
                can: false,
                reason: "readonly",
            };
        }

        return {
            can: action === "list" || action === "show" || action === "read",
            reason: "readonly",
        };
    },
};

export { readAdminSession };
