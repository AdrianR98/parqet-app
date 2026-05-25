"use client";

import { Refine, useCan, useIsAuthenticated } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { adminAccessControlProvider, adminAuthProvider } from "@/lib/admin/refine";
import styles from "./page.module.css";

const PLACEHOLDER_RESOURCES = [
    "Market Data Status",
    "Instruments",
    "Mappings",
    "Unmapped Assets",
    "Runs",
] as const;

function SessionBadge({ state }: { state: "enabled" | "disabled" | "loading" }) {
    if (state === "loading") {
        return <span className={`${styles.badge} ${styles.badgeMuted}`}>Checking session</span>;
    }

    if (state === "enabled") {
        return <span className={`${styles.badge} ${styles.badgeSuccess}`}>Enabled (read-only)</span>;
    }

    return <span className={`${styles.badge} ${styles.badgeWarning}`}>Disabled / Unauthorized</span>;
}

function AdminPanel() {
    const auth = useIsAuthenticated();
    const listAccess = useCan({ resource: "admin", action: "list" });
    const createAccess = useCan({ resource: "admin", action: "create" });

    const sessionState = auth.isLoading
        ? "loading"
        : auth.data?.authenticated
          ? "enabled"
          : "disabled";

    return (
        <main className={styles.root}>
            <section className={`${styles.surface} ${styles.header}`}>
                <p className={styles.eyebrow}>Admin Console</p>
                <h1>Read-only Admin</h1>
                <div className={styles.statusRow}>
                    <span>Current admin session status</span>
                    <SessionBadge state={sessionState} />
                </div>
                <p className={styles.note}>
                    This shell is read-only. No writes, no provider calls, and no production admin auth are enabled.
                </p>
            </section>

            <section className={`${styles.surface} ${styles.guard}`}>
                <h2>Guard summary</h2>
                <p>
                    Session check uses <code>/api/admin/session</code>. Mutation actions are blocked by access control.
                </p>
                <ul>
                    <li>List access: {listAccess.data?.can ? "allowed" : "denied"}</li>
                    <li>Create access: {createAccess.data?.can ? "allowed" : "denied"}</li>
                </ul>
            </section>

            <section className={styles.grid}>
                {PLACEHOLDER_RESOURCES.map((name) => (
                    <article className={styles.card} key={name}>
                        <h3>{name}</h3>
                        <p>Placeholder only. Resource wiring is intentionally deferred.</p>
                    </article>
                ))}
            </section>
        </main>
    );
}

export default function AdminShell() {
    return (
        <Refine
            authProvider={adminAuthProvider}
            accessControlProvider={adminAccessControlProvider}
            routerProvider={routerProvider}
            resources={[]}
        >
            <AdminPanel />
        </Refine>
    );
}
