export type AdminSessionReason = "disabled" | "enabled_readonly";

export type AdminSessionPayload = {
    authenticated: boolean;
    admin: boolean;
    readonly: true;
    roles: string[];
    permissions: string[];
    reason: AdminSessionReason;
};

const READONLY_ROLES = ["admin:readonly"] as const;
const READONLY_PERMISSIONS = ["admin:read", "market-data:read"] as const;

function isAdminEnabledFlag(value: string | undefined): boolean {
    return value === "true";
}

export function buildAdminSession(envValue: string | undefined = process.env.ADMIN_ENABLED): AdminSessionPayload {
    if (!isAdminEnabledFlag(envValue)) {
        return {
            authenticated: false,
            admin: false,
            readonly: true,
            roles: [],
            permissions: [],
            reason: "disabled",
        };
    }

    return {
        authenticated: true,
        admin: true,
        readonly: true,
        roles: [...READONLY_ROLES],
        permissions: [...READONLY_PERMISSIONS],
        reason: "enabled_readonly",
    };
}

export function isWritePermission(permission: string): boolean {
    return /(create|edit|update|delete|write|mutate)/i.test(permission);
}
