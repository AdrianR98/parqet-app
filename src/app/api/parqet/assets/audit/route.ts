// src/app/api/parqet/assets/audit/route.ts

import { NextResponse } from "next/server";
import {
    getCookieValue,
    refreshParqetAccessToken,
} from "../../../../../lib/parqet";
import { fetchAuthorizedPortfolios } from "../../../../../lib/parqet-assets/fetch-portfolios";
import { loadActivitiesForPortfolios } from "../../../../../lib/parqet-assets/fetch-activities";
import { isRealSecurityActivity } from "../../../../../lib/parqet-assets/filters";
import { normalizeActivities } from "../../../../../lib/parqet-assets/normalization";
import { applyOverrides } from "../../../../../lib/parqet-assets/overrides";
import { buildReconciliationWarnings } from "../../../../../lib/parqet-assets/reconciliation";
import { toNumber } from "../../../../../lib/parqet-assets/activity-utils";
import { readActivityOverrides } from "../../../../../lib/parqet-assets/override-store";
import type {
    ActivitiesAuditApiResponse,
    ActivitiesAuditItem,
    ActivitiesAuditSummary,
    ActivityOverride,
    AppliedOverrideMap,
} from "../../../../../lib/types";

/**
 * ============================================================
 * AUDIT ROUTE
 * ============================================================
 *
 * Zweck:
 * - liefert die Audit-/Bearbeitungsdaten für genau ein Asset
 * - filtert auf ISIN + ausgewählte Portfolios
 * - arbeitet auf den normalisierten Activities
 * - wendet danach manuelle Overrides an
 * - liefert zusätzlich:
 *   - Reconciliation-Warnungen
 *   - Summary-Zahlen
 *   - Originalwerte vs. Override-Werte
 *
 * Wichtig für spätere Erweiterungen:
 * - hier ist der zentrale Ort für zusätzliche Audit-Felder
 * - hier werden oft Mapping-Felder ergänzt
 * - hier hängen künftig auch "delete override", "notes", "status" etc.
 */

/**
 * ============================================================
 * HELPER: Einheitliche leere Summary
 * ============================================================
 *
 * Diesen Block später wiederverwenden, wenn:
 * - weitere Error-/Fallback-Responses dazu kommen
 * - neue Summary-Felder ergänzt werden
 */
function emptySummary(): ActivitiesAuditSummary {
    return {
        total: 0,
        buyCount: 0,
        sellCount: 0,
        dividendCount: 0,
        transferInCount: 0,
        transferOutCount: 0,
        unknownCount: 0,
    };
}

/**
 * ============================================================
 * HELPER: Einheitliche Reconnect-Response
 * ============================================================
 *
 * Dieser Block ist bewusst zentral gehalten.
 * Falls wir später die Reconnect-Logik app-weit erweitern,
 * ist das einer der Hauptstellen, an denen wir wieder ergänzen.
 */
function buildReconnectResponse(message: string) {
    const response = NextResponse.json(
        {
            ok: false,
            generatedAt: new Date().toISOString(),
            portfolios: [],
            items: [],
            reconciliationWarnings: [],
            summary: emptySummary(),
            authRequired: true,
            reconnectUrl: "/api/auth/start",
            message,
        } satisfies ActivitiesAuditApiResponse,
        { status: 401 }
    );

    response.cookies.set("parqet_access_token", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    response.cookies.set("parqet_refresh_token", "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });

    return response;
}

/**
 * ============================================================
 * HELPER: Monatsschlüssel
 * ============================================================
 *
 * Falls wir später andere Gruppierungen brauchen
 * (Quartal, Woche, Buchungsperiode), hier erweitern.
 */
function getMonthKey(value: string): string {
    return value.slice(0, 7);
}

/**
 * ============================================================
 * HELPER: Monatstitel
 * ============================================================
 *
 * Dient aktuell nur dem UI.
 * Falls später Internationalisierung kommt, ist das ein
 * typischer Block zum Auslagern.
 */
function getMonthLabel(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value.slice(0, 7);
    }

    return new Intl.DateTimeFormat("de-DE", {
        month: "long",
        year: "numeric",
    }).format(date);
}

/**
 * ============================================================
 * HELPER: Audit-Summary berechnen
 * ============================================================
 *
 * Falls später zusätzliche Typen oder Kennzahlen kommen,
 * müssen sie hier ergänzt werden.
 */
function buildAuditSummary(items: ActivitiesAuditItem[]): ActivitiesAuditSummary {
    return {
        total: items.length,
        buyCount: items.filter((item) => item.type === "buy").length,
        sellCount: items.filter((item) => item.type === "sell").length,
        dividendCount: items.filter((item) => item.type === "dividend").length,
        transferInCount: items.filter((item) => item.type === "transfer_in").length,
        transferOutCount: items.filter((item) => item.type === "transfer_out").length,
        unknownCount: items.filter((item) => item.type === "unknown").length,
    };
}

/**
 * ============================================================
 * HELPER: Override-Werte auf Feldname reduzieren
 * ============================================================
 *
 * Warum:
 * - im UI wollen wir schnell sehen, welches Feld welchen
 *   Override-Wert bekommen hat
 * - appliedOverrides ist ein Array
 * - fürs UI ist ein Feld-zu-Wert-Mapping oft praktischer
 *
 * Typischer Erweiterungspunkt:
 * - später zusätzlich oldValue, note, user, ruleId etc.
 */
function buildOverrideValueMap(
    appliedOverrides: ActivityOverride[] | undefined
): Record<string, string | number | null> | null {
    if (!appliedOverrides || appliedOverrides.length === 0) {
        return null;
    }

    const result: Record<string, string | number | null> = {};

    for (const entry of appliedOverrides) {
        result[entry.field] = entry.value;
    }

    return result;
}

/**
 * ============================================================
 * HELPER: Originalwerte für den Audit-Vergleich
 * ============================================================
 *
 * Sehr wichtig:
 * - diese Werte müssen aus den normalisierten Activities VOR
 *   applyOverrides stammen
 * - sonst wäre "original" bereits überschrieben
 *
 * Genau an diesem Punkt ergänzen wir künftig weitere Felder,
 * wenn mehr Werte vergleichbar gemacht werden sollen.
 */
function buildOriginalValues(
    originalActivity:
        | {
            shares?: number | null;
            price?: number | null;
            amount?: number | null;
            amountNet?: number | null;
            type?: string | null;
        }
        | undefined
) {
    return {
        shares: originalActivity?.shares ?? null,
        price: originalActivity?.price ?? null,
        amount: originalActivity?.amount ?? null,
        amountNet: originalActivity?.amountNet ?? null,
        type: originalActivity?.type ?? null,
    };
}

/**
 * ============================================================
 * ROUTE
 * ============================================================
 *
 * Query-Parameter:
 * - isin=...
 * - portfolioId=... (mehrfach möglich)
 *
 * Typischer späterer Erweiterungspunkt:
 * - assetId
 * - includeRawActivities
 * - includeAllPortfolioMatches
 * - filter by date range
 */
export async function GET(req: Request) {
    try {
        /**
         * ------------------------------------------------------------
         * QUERY PARAMETER EINLESEN
         * ------------------------------------------------------------
         */
        const url = new URL(req.url);
        const isin = (url.searchParams.get("isin") ?? "").trim().toUpperCase();
        const portfolioIds = url.searchParams.getAll("portfolioId");

        if (!isin) {
            return NextResponse.json(
                {
                    ok: false,
                    generatedAt: new Date().toISOString(),
                    portfolios: [],
                    items: [],
                    reconciliationWarnings: [],
                    summary: emptySummary(),
                    message: "Missing required query parameter: isin.",
                } satisfies ActivitiesAuditApiResponse,
                { status: 400 }
            );
        }

        if (portfolioIds.length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    generatedAt: new Date().toISOString(),
                    portfolios: [],
                    items: [],
                    reconciliationWarnings: [],
                    summary: emptySummary(),
                    message: "No portfolioId parameters provided.",
                } satisfies ActivitiesAuditApiResponse,
                { status: 400 }
            );
        }

        /**
         * ------------------------------------------------------------
         * AUTH / TOKEN AUS COOKIES LESEN
         * ------------------------------------------------------------
         *
         * Typischer Erweiterungspunkt:
         * - künftig evtl. Session-Store statt nur Cookies
         * - weitere Auth-Metadaten
         */
        const cookieHeader = req.headers.get("cookie") || "";
        let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
        const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

        if (!accessToken) {
            return buildReconnectResponse(
                "Parqet-Verbindung nicht vorhanden oder abgelaufen."
            );
        }

        /**
         * ------------------------------------------------------------
         * KERNLOGIK: AUDIT DATEN AUFBAUEN
         * ------------------------------------------------------------
         *
         * Dieser Block ist absichtlich als eigene innere Funktion
         * gekapselt, damit wir ihn nach Token-Refresh erneut nutzen
         * können.
         *
         * Hier werden wir künftig am häufigsten ergänzen:
         * - neue Vergleichsfelder
         * - neue Warnungen
         * - Override-Metadaten
         * - zusätzliche UI-Felder
         */
        async function buildAuditView(
            currentAccessToken: string
        ): Promise<ActivitiesAuditApiResponse> {
            /**
             * --------------------------------------------------------
             * PORTFOLIOS LADEN
             * --------------------------------------------------------
             */
            const portfolios = await fetchAuthorizedPortfolios(currentAccessToken);
            const selectedPortfolios = portfolios.filter((portfolio) =>
                portfolioIds.includes(portfolio.id)
            );

            const portfolioNameById = new Map<string, string>();
            for (const portfolio of portfolios) {
                portfolioNameById.set(portfolio.id, portfolio.name);
            }

            /**
             * --------------------------------------------------------
             * ACTIVITIES LADEN
             * --------------------------------------------------------
             */
            const allActivities = await loadActivitiesForPortfolios(
                currentAccessToken,
                portfolioIds
            );

            /**
             * --------------------------------------------------------
             * PIPELINE: FILTER -> NORMALIZE -> OVERRIDES
             * --------------------------------------------------------
             *
             * Wichtiger Architekturpunkt:
             * - normalized = Basis / "Originalwerte"
             * - corrected  = bereinigte / überschriebenen Werte
             *
             * Genau diese Trennung brauchen wir, um im Audit später
             * "alt vs. neu" sauber zeigen zu können.
             */
            const filteredActivities = allActivities.filter(isRealSecurityActivity);
            const normalized = normalizeActivities(filteredActivities);

            const overrides = await readActivityOverrides();
            const corrected = applyOverrides(normalized, overrides);

            /**
             * --------------------------------------------------------
             * NUR DAS ANGEFRAGTE ASSET (ISIN) IM AUDIT
             * --------------------------------------------------------
             *
             * Typischer Erweiterungspunkt:
             * - später evtl. auch nach activityId oder assetId
             * - oder zusätzlich fuzzy matching / transfer matching
             */
            const normalizedForAsset = normalized.filter(
                (activity) => (activity.isin ?? "").trim().toUpperCase() === isin
            );

            const correctedForAsset = corrected.filter(
                (activity) => (activity.isin ?? "").trim().toUpperCase() === isin
            );

            /**
             * --------------------------------------------------------
             * WARNUNGEN AUF KORRIGIERTEN DATEN BERECHNEN
             * --------------------------------------------------------
             *
             * Bewusst auf correctedForAsset:
             * - damit Overrides direkt Einfluss auf Warnungen haben
             */
            const warnings = buildReconciliationWarnings(correctedForAsset);

            /**
             * --------------------------------------------------------
             * AUDIT ITEMS MAPPEN
             * --------------------------------------------------------
             *
             * Das ist einer der wichtigsten Erweiterungspunkte im Projekt.
             * Hier ergänzen wir typischerweise:
             * - neue Anzeige-Felder
             * - Originalwerte
             * - Overridewerte
             * - Status
             * - Edit-Hinweise
             * - spätere DB-Metadaten
             */
            const items: ActivitiesAuditItem[] = correctedForAsset
                .map((activity) => {
                    /**
                     * ------------------------------------------------
                     * ORIGINAL AKTIVITÄT VOR OVERRIDES SUCHEN
                     * ------------------------------------------------
                     *
                     * Ganz wichtig:
                     * - originalValues dürfen NICHT aus corrected
                     *   gelesen werden
                     * - sonst wären Original und Override identisch
                     */
                    const originalActivity = normalizedForAsset.find(
                        (entry) => entry.id === activity.id
                    );

                    const datetime = activity.datetime ?? "";
                    const portfolioName = activity.portfolioId
                        ? portfolioNameById.get(activity.portfolioId) ?? activity.portfolioId
                        : "Unknown Portfolio";

                    const warningMessages = warnings
                        .filter((warning) => warning.isin === isin)
                        .map((warning) => warning.message);

                    const hasOverrides = activity.hasOverrides;
                    const overrideFlags: AppliedOverrideMap | undefined =
                        activity.overrideFlags;

                    /**
                     * ------------------------------------------------
                     * ORIGINAL- UND OVERRIDE-WERTE AUFBAUEN
                     * ------------------------------------------------
                     *
                     * Genau hier später weitere Felder ergänzen:
                     * - datetime
                     * - portfolioId
                     * - portfolioName
                     * - symbol
                     * - wkn
                     * - isin
                     */
                    const originalValues = buildOriginalValues(originalActivity);
                    const overrideValues = buildOverrideValueMap(
                        activity.appliedOverrides
                    );

                    return {
                        id: activity.id,
                        datetime,
                        year: new Date(datetime).getFullYear(),
                        monthKey: getMonthKey(datetime),
                        monthLabel: getMonthLabel(datetime),

                        portfolioId: activity.portfolioId ?? null,
                        portfolioName,

                        isin,
                        name: activity.name ?? activity.symbol ?? activity.wkn ?? isin,
                        symbol: activity.symbol ?? null,
                        wkn: activity.wkn ?? null,

                        type: activity.type ?? "unknown",
                        rawType: activity.rawType ?? activity.type ?? "unknown",

                        shares: toNumber(activity.shares),
                        price: toNumber(activity.price),
                        amount: toNumber(activity.amount),
                        amountNet: toNumber(activity.amountNet),

                        warningMessages,

                        /**
                         * --------------------------------------------
                         * OVERRIDE-METADATEN
                         * --------------------------------------------
                         *
                         * Typischer Erweiterungspunkt:
                         * - changedBy
                         * - changeSource
                         * - lastOverrideAt
                         * - overrideNotes
                         */
                        hasOverrides,
                        overrideFlags,
                        overrideCount: activity.appliedOverrides?.length ?? 0,
                        originalValues,
                        overrideValues,
                    };
                })
                .sort((a, b) => b.datetime.localeCompare(a.datetime));

            /**
             * --------------------------------------------------------
             * RESPONSE OBJEKT
             * --------------------------------------------------------
             */
            return {
                ok: true,
                generatedAt: new Date().toISOString(),
                portfolios: selectedPortfolios,
                items,
                reconciliationWarnings: warnings,
                summary: buildAuditSummary(items),
            };
        }

        /**
         * ------------------------------------------------------------
         * ERSTER VERSUCH MIT AKTUELLEM ACCESS TOKEN
         * ------------------------------------------------------------
         */
        try {
            const result = await buildAuditView(accessToken);
            return NextResponse.json(result);
        } catch (error) {
            /**
             * --------------------------------------------------------
             * FALLBACK: TOKEN REFRESH
             * --------------------------------------------------------
             *
             * Wenn kein Refresh-Token vorhanden ist, geben wir den
             * eigentlichen Fehler weiter.
             */
            if (!refreshToken) {
                throw error;
            }

            const refreshed = await refreshParqetAccessToken(refreshToken);

            if (!refreshed.accessToken) {
                return buildReconnectResponse(
                    "Parqet-Verbindung ist abgelaufen. Bitte erneut verbinden."
                );
            }

            accessToken = refreshed.accessToken;
            const result = await buildAuditView(accessToken);

            const response = NextResponse.json(result);

            response.cookies.set("parqet_access_token", accessToken, {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
            });

            if (refreshed.newRefreshToken) {
                response.cookies.set("parqet_refresh_token", refreshed.newRefreshToken, {
                    httpOnly: true,
                    sameSite: "lax",
                    path: "/",
                });
            }

            return response;
        }
    } catch (error: unknown) {
        /**
         * ------------------------------------------------------------
         * GLOBALER FEHLERFALL
         * ------------------------------------------------------------
         *
         * Dieser Block ist wichtig für Debugging.
         * Falls künftig wieder etwas "nur allgemein" fehlschlägt,
         * hier zuerst auf details achten.
         */
        return NextResponse.json(
            {
                ok: false,
                generatedAt: new Date().toISOString(),
                portfolios: [],
                items: [],
                reconciliationWarnings: [],
                summary: emptySummary(),
                message: "Asset audit route failed.",
                details: error instanceof Error ? error.message : String(error),
            } satisfies ActivitiesAuditApiResponse,
            { status: 500 }
        );
    }
}