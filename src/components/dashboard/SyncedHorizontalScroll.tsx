// ============================================================
// src/components/dashboard/SyncedHorizontalScroll.tsx
// ------------------------------------------------------------
// Synchronisierte obere Scrollbar fuer breite Tabellen.
//
// FIX:
// - TS Null-Probleme sauber gelöst
// - sichere Zugriffsmuster in Event-Handlern
// ============================================================

"use client";

import { useEffect, useRef } from "react";
import styles from "./SyncedHorizontalScroll.module.css";

type SyncedHorizontalScrollProps = {
    scrollTargetRef: React.RefObject<HTMLDivElement | null>;
};

export default function SyncedHorizontalScroll({
    scrollTargetRef,
}: SyncedHorizontalScrollProps) {
    const topScrollRef = useRef<HTMLDivElement | null>(null);
    const topContentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // ====================================================
        // Initiale Referenzen holen
        // ====================================================

        const topScrollElement = topScrollRef.current;
        const topContentElement = topContentRef.current;
        const targetElement = scrollTargetRef.current;

        if (!topScrollElement || !topContentElement || !targetElement) {
            return;
        }

        let isSyncingFromTop = false;
        let isSyncingFromBottom = false;

        // ====================================================
        // Sync Breite (wichtig für Scrollbar)
        // ====================================================

        function syncWidth() {
            if (!topContentRef.current || !scrollTargetRef.current) return;

            topContentRef.current.style.width =
                `${scrollTargetRef.current.scrollWidth}px`;
        }

        // ====================================================
        // Top → Table Scroll
        // ====================================================

        function handleTopScroll() {
            const top = topScrollRef.current;
            const target = scrollTargetRef.current;

            if (!top || !target) return;

            if (isSyncingFromBottom) {
                isSyncingFromBottom = false;
                return;
            }

            isSyncingFromTop = true;
            target.scrollLeft = top.scrollLeft;
        }

        // ====================================================
        // Table → Top Scroll
        // ====================================================

        function handleTargetScroll() {
            const top = topScrollRef.current;
            const target = scrollTargetRef.current;

            if (!top || !target) return;

            if (isSyncingFromTop) {
                isSyncingFromTop = false;
                return;
            }

            isSyncingFromBottom = true;
            top.scrollLeft = target.scrollLeft;
        }

        // ====================================================
        // Events registrieren
        // ====================================================

        syncWidth();

        topScrollElement.addEventListener("scroll", handleTopScroll);
        targetElement.addEventListener("scroll", handleTargetScroll);
        window.addEventListener("resize", syncWidth);

        // ====================================================
        // Cleanup
        // ====================================================

        return () => {
            topScrollElement.removeEventListener("scroll", handleTopScroll);
            targetElement.removeEventListener("scroll", handleTargetScroll);
            window.removeEventListener("resize", syncWidth);
        };
    }, [scrollTargetRef]);

    // ====================================================
    // Render
    // ====================================================

    return (
        <div
            ref={topScrollRef}
            className={styles.topScroll}
            aria-label="Horizontales Scrollen der Tabelle"
        >
            <div ref={topContentRef} className={styles.topScrollContent} />
        </div>
    );
}