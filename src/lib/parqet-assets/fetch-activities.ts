import type { Activity } from "./activity-types";

// Diese Funktion laedt alle Activities fuer genau ein Portfolio.
// Sie geht alle Seiten ueber den Cursor durch.
export async function fetchAllActivitiesForPortfolio(
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
export async function loadActivitiesForPortfolios(
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