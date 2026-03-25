import type { Portfolio } from "./activity-types";

// Diese Funktion laedt alle autorisierten Portfolios.
// Das nutzen wir, um spaeter Portfolio-Namen statt nur IDs zurueckzugeben.
export async function fetchAuthorizedPortfolios(
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