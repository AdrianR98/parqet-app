import { NextResponse } from "next/server";
import {
    getCookieValue,
    refreshParqetAccessToken,
} from "../../../../lib/parqet";

// Dieses Interface beschreibt die Struktur eines Portfolios aus Parqet.
type Portfolio = {
    id: string;
    name: string;
    currency: string;
    createdAt: string;
    distinctBrokers: string[];
};

// Dieses Interface beschreibt die minimal benoetigten Activity-Felder aus Parqet.
type Activity = {
    id: string;
    type: string;
    shares?: number;
    amount?: number;
    amountNet?: number;
    price?: number;
    fee?: number;
    tax?: number;
    currency?: string;
    datetime: string;
    holdingAssetType?: string;
    portfolioId?: string;
    asset?: {
        isin?: string;
        assetIdentifierType?: string;
    };
};

// Dieses Interface beschreibt die Asset-Zusammenfassung fuer das Frontend.
type AssetSummary = {
    isin: string;
    portfolioIds: string[];
    portfolioNames: string[];
    activityCount: number;
    buyCount: number;
    sellCount: number;
    dividendCount: number;
    totalBoughtShares: number;
    totalSoldShares: number;
    netShares: number;
    totalInvestedGross: number;
    remainingCostBasis: number;
    avgBuyPrice: number;
    latestTradePrice: number | null;
    positionValue: number | null;
    unrealizedPnL: number | null;
    totalDividendNet: number;
    latestActivityAt: string | null;
};

// Diese interne Struktur wird waehrend der Berechnung verwendet.
type AssetAccumulator = AssetSummary;

// Diese Funktion wandelt unbekannte Zahlenwerte sicher in number um.
function toNumber(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.replace(",", ".");
        const parsed = Number(normalized);

        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return 0;
}

// Diese Funktion laedt alle autorisierten Portfolios.
// Das nutzen wir, um spaeter Portfolio-Namen statt nur IDs zurueckzugeben.
async function fetchAuthorizedPortfolios(
    accessToken: string
): Promise<Portfolio[]> {
    const res = await fetch("https://connect.parqet.com/portfolios", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    const rawText = await res.text();

    if (!res.ok) {
        throw new Error(`Portfolio fetch failed (${res.status}): ${rawText}`);
    }

    const data: {
        items?: Portfolio[];
    } = JSON.parse(rawText);

    return data.items ?? [];
}

// Diese Funktion laedt alle Activities fuer genau ein Portfolio.
// Sie geht alle Seiten ueber den Cursor durch.
async function fetchAllActivitiesForPortfolio(
    accessToken: string,
    portfolioId: string
): Promise<Activity[]> {
    const allActivities: Activity[] = [];
    let cursor: string | null = null;

    while (true) {
        const url = new URL(
            `https://connect.parqet.com/portfolios/${portfolioId}/activities`
        );

        // Wenn ein Cursor vorhanden ist, laden wir die naechste Seite.
        if (cursor) {
            url.searchParams.set("cursor", cursor);
        }

        const res = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const rawText = await res.text();

        if (!res.ok) {
            throw new Error(
                `Activities fetch failed for portfolio ${portfolioId} (${res.status}): ${rawText}`
            );
        }

        const data: {
            activities?: Activity[];
            cursor?: string;
        } = JSON.parse(rawText);

        const activities = data.activities ?? [];

        // Alle Activities sammeln.
        allActivities.push(...activities);

        // Cursor fuer die naechste Seite setzen.
        cursor = data.cursor ?? null;

        // Wenn kein Cursor mehr vorhanden ist, sind wir fertig.
        if (!cursor) {
            break;
        }
    }

    // Jede Activity mit der Portfolio-ID anreichern.
    return allActivities.map((activity) => ({
        ...activity,
        portfolioId,
    }));
}

// Diese Funktion laedt alle Activities fuer mehrere Portfolios.
async function loadActivitiesForPortfolios(
    accessToken: string,
    portfolioIds: string[]
): Promise<Activity[]> {
    const results: Activity[][] = [];

    for (const portfolioId of portfolioIds) {
        const activities = await fetchAllActivitiesForPortfolio(
            accessToken,
            portfolioId
        );
        results.push(activities);
    }

    return results.flat();
}

// Diese Funktion prueft, ob eine Activity ein echter Wertpapier-Event ist.
// Wir schliessen hier bewusst Cash-Spiegelungen und Referencing-Eintraege aus.
function isRealSecurityActivity(activity: Activity): boolean {
    const isin = activity.asset?.isin;
    const assetIdentifierType = activity.asset?.assetIdentifierType;
    const holdingAssetType = activity.holdingAssetType;
    const id = activity.id || "";

    // Ohne ISIN ist die Activity fuer die Asset-Sicht nicht relevant.
    if (!isin) {
        return false;
    }

    // Wir betrachten zunaechst nur echte ISIN-basierte Assets.
    if (assetIdentifierType !== "isin") {
        return false;
    }

    // Nur Security-Holdings behalten.
    if (holdingAssetType !== "security") {
        return false;
    }

    // Spiegelnde Cash-/Referencing-Eintraege ausschliessen.
    if (id.startsWith("cpa_referencing_")) {
        return false;
    }

    return true;
}

// Diese Funktion gruppiert die Activities nach ISIN und berechnet
// die wichtigsten Asset-Kennzahlen.
//
// Wichtige fachliche Annahme fuer das MVP:
// - Kostenbasis wird mit Durchschnittseinstand berechnet
// - latestTradePrice ist nur ein Kurs-Proxy aus dem letzten Buy/Sell
function groupActivitiesByIsin(
    activities: Activity[],
    portfolioNameById: Map<string, string>
): AssetSummary[] {
    const grouped = new Map<string, AssetAccumulator>();

    // Activities chronologisch sortieren.
    // Das ist wichtig fuer die saubere Bestands- und Kostenbasislogik.
    const sortedActivities = [...activities].sort((a, b) => {
        return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
    });

    for (const activity of sortedActivities) {
        const isin = activity.asset?.isin;

        if (!isin) {
            continue;
        }

        // Falls die ISIN noch nicht existiert, einen neuen Accumulator anlegen.
        if (!grouped.has(isin)) {
            grouped.set(isin, {
                isin,
                portfolioIds: [],
                portfolioNames: [],
                activityCount: 0,
                buyCount: 0,
                sellCount: 0,
                dividendCount: 0,
                totalBoughtShares: 0,
                totalSoldShares: 0,
                netShares: 0,
                totalInvestedGross: 0,
                remainingCostBasis: 0,
                avgBuyPrice: 0,
                latestTradePrice: null,
                positionValue: null,
                unrealizedPnL: null,
                totalDividendNet: 0,
                latestActivityAt: null,
            });
        }

        const item = grouped.get(isin)!;

        item.activityCount += 1;

        // Portfolio-ID nur einmal speichern.
        if (activity.portfolioId && !item.portfolioIds.includes(activity.portfolioId)) {
            item.portfolioIds.push(activity.portfolioId);

            const portfolioName =
                portfolioNameById.get(activity.portfolioId) ?? activity.portfolioId;

            if (!item.portfolioNames.includes(portfolioName)) {
                item.portfolioNames.push(portfolioName);
            }
        }

        const shares = toNumber(activity.shares);
        const amount = toNumber(activity.amount);
        const amountNet = toNumber(activity.amountNet);
        const price = toNumber(activity.price);

        // Buy-Logik:
        // - Bestand steigt
        // - Investitionssumme steigt
        // - Kostenbasis steigt
        // - letzter Trade-Preis wird aktualisiert
        if (activity.type === "buy") {
            item.buyCount += 1;
            item.totalBoughtShares += shares;
            item.netShares += shares;
            item.totalInvestedGross += amount;
            item.remainingCostBasis += amount;

            // Den letzten Kaufpreis als Kurs-Proxy merken.
            if (price > 0) {
                item.latestTradePrice = price;
            }
        }

        // Sell-Logik:
        // - Bestand sinkt
        // - verkaufte Stuecke erhoehen totalSoldShares
        // - Kostenbasis sinkt um den Durchschnittseinstand * verkaufte Stuecke
        // - letzter Trade-Preis wird aktualisiert
        if (activity.type === "sell") {
            item.sellCount += 1;
            item.totalSoldShares += shares;

            // Den aktuellen Durchschnittseinstand vor der Reduktion berechnen.
            const currentAvgBuyPrice =
                item.netShares > 0 ? item.remainingCostBasis / item.netShares : 0;

            // Die Kostenbasis fuer die verkauften Stuecke entfernen.
            const removedCostBasis = currentAvgBuyPrice * shares;
            item.remainingCostBasis -= removedCostBasis;

            // Bestand reduzieren.
            item.netShares -= shares;

            // Sicherheitsnetz gegen negative Rundungsfehler.
            if (item.netShares < 0 && Math.abs(item.netShares) < 0.0000001) {
                item.netShares = 0;
            }

            if (
                item.remainingCostBasis < 0 &&
                Math.abs(item.remainingCostBasis) < 0.0000001
            ) {
                item.remainingCostBasis = 0;
            }

            // Den letzten Verkaufspreis als Kurs-Proxy merken.
            if (price > 0) {
                item.latestTradePrice = price;
            }
        }

        // Dividend-Logik:
        // - Dividenden nur netto aufsummieren
        if (activity.type === "dividend") {
            item.dividendCount += 1;
            item.totalDividendNet += amountNet || amount;
        }

        // Letzte Aktivitaet merken.
        if (
            !item.latestActivityAt ||
            new Date(activity.datetime).getTime() >
            new Date(item.latestActivityAt).getTime()
        ) {
            item.latestActivityAt = activity.datetime;
        }

        // Durchschnittseinstand nach jeder Activity neu berechnen.
        item.avgBuyPrice =
            item.netShares > 0 ? item.remainingCostBasis / item.netShares : 0;

        // Positionswert nur berechnen, wenn wir einen Kurs-Proxy haben.
        item.positionValue =
            item.latestTradePrice !== null ? item.netShares * item.latestTradePrice : null;

        // Unrealisierter Gewinn / Verlust nur berechnen, wenn Positionswert bekannt ist.
        item.unrealizedPnL =
            item.positionValue !== null
                ? item.positionValue - item.remainingCostBasis
                : null;
    }

    // Ergebnisliste erzeugen und sinnvoll sortieren.
    return Array.from(grouped.values()).sort((a, b) => {
        const aTime = a.latestActivityAt ? new Date(a.latestActivityAt).getTime() : 0;
        const bTime = b.latestActivityAt ? new Date(b.latestActivityAt).getTime() : 0;

        return bTime - aTime;
    });
}

// Diese Route baut die erste echte Asset-Sicht aus den ausgewaehlten Portfolios.
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);

        // Mehrere Portfolio-IDs koennen mehrfach uebergeben werden:
        // /api/parqet/assets?portfolioId=...&portfolioId=...
        const portfolioIds = url.searchParams.getAll("portfolioId");

        if (portfolioIds.length === 0) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No portfolioId parameters provided.",
                },
                { status: 400 }
            );
        }

        const cookieHeader = req.headers.get("cookie") || "";

        let accessToken = getCookieValue(cookieHeader, "parqet_access_token");
        const refreshToken = getCookieValue(cookieHeader, "parqet_refresh_token");

        if (!accessToken) {
            return NextResponse.json(
                {
                    ok: false,
                    message: "No access token found.",
                },
                { status: 401 }
            );
        }

        // Diese Hilfsfunktion fuehrt den kompletten Datenladeprozess aus:
        // - Portfolios laden
        // - Activity-Historie laden
        // - filtern
        // - nach ISIN aggregieren
        async function buildAssetView(currentAccessToken: string) {
            const portfolios = await fetchAuthorizedPortfolios(currentAccessToken);
            const portfolioNameById = new Map<string, string>();

            for (const portfolio of portfolios) {
                portfolioNameById.set(portfolio.id, portfolio.name);
            }

            const allActivities = await loadActivitiesForPortfolios(
                currentAccessToken,
                portfolioIds
            );

            const filteredActivities = allActivities.filter(isRealSecurityActivity);
            const assets = groupActivitiesByIsin(filteredActivities, portfolioNameById);

            return {
                rawActivityCount: allActivities.length,
                filteredActivityCount: filteredActivities.length,
                assetCount: assets.length,
                assets,
            };
        }

        try {
            // Erster Versuch mit aktuellem Access Token.
            const result = await buildAssetView(accessToken);

            return NextResponse.json({
                ok: true,
                refreshed: false,
                requestedPortfolioIds: portfolioIds,
                ...result,
            });
        } catch (error) {
            // Wenn der erste Versuch scheitert und ein Refresh Token vorhanden ist,
            // versuchen wir automatisch einen Token-Refresh.
            if (!refreshToken) {
                throw error;
            }

            const refreshed = await refreshParqetAccessToken(refreshToken);

            if (!refreshed.accessToken) {
                return NextResponse.json(
                    {
                        ok: false,
                        message: "Access token expired and refresh failed.",
                    },
                    { status: 401 }
                );
            }

            accessToken = refreshed.accessToken;

            const result = await buildAssetView(accessToken);

            const response = NextResponse.json({
                ok: true,
                refreshed: true,
                requestedPortfolioIds: portfolioIds,
                ...result,
            });

            // Neue Tokens in Cookies zurueckschreiben.
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
        return NextResponse.json(
            {
                ok: false,
                message: "Assets route failed.",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}