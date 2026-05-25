import { Suspense } from "react";
import AdminShell from "./AdminShell";

export default function AdminPage() {
    return (
        <Suspense fallback={null}>
            <AdminShell />
        </Suspense>
    );
}
