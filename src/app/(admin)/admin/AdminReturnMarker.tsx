"use client";

import { useEffect } from "react";
import { ADMIN_RETURN_PENDING_KEY } from "../../../lib/admin-return-restore-guard";

export default function AdminReturnMarker() {
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.sessionStorage.setItem(ADMIN_RETURN_PENDING_KEY, "1");
    }, []);

    return null;
}
