import { Suspense } from "react";
import AdminShell from "./AdminShell";
import AdminReturnMarker from "./AdminReturnMarker";

export default function AdminPage() {
    return (
        <Suspense fallback={null}>
            <AdminReturnMarker />
            <AdminShell />
        </Suspense>
    );
}
