import type { Activity } from "./activity-types";

const DEFAULT_PORTFOLIO_ACTIVITIES_CONCURRENCY = 3;
const MIN_PORTFOLIO_ACTIVITIES_CONCURRENCY = 1;
const MAX_PORTFOLIO_ACTIVITIES_CONCURRENCY = 5;
const DEFAULT_ACTIVITY_PAGE_LIMIT = 500;

export type ParqetActivityTypeFilter =
    | "buy"
    | "sell"
    | "dividend"
    | "interest"
    | "transfer_in"
    | "transfer_out"
    | "fees_taxes"
    | "deposit"
    | "withdrawal";

export type ParqetAssetTypeFilter =
    | "cash"
    | "security"
    | "crypto"
    | "commodity"
    | "custom"
    | "real_estate";

export type FetchActivitiesOptions = {
    activityTypes?: ParqetActivityTypeFilter[];
    assetTypes?: ParqetAssetTypeFilter[];
    holdingIds?: string[];
    limit?: number;
};

const DEFAULT_FETCH_ACTIVITIES_OPTIONS: FetchActivitiesOptions = {
    assetTypes: ["security"],
    limit: DEFAULT_ACTIVITY_PAGE_LIMIT,
};

function getPortfolioActivitiesConcurrency(): number {
    const rawValue = process.env.PARQET_ACTIVITY_FETCH_CONCURRENCY;
    const parsed = rawValue ? Number(rawValue) : DEFAULT_PORTFOLIO_ACTIVITIES_CONCURRENCY;

    if (!Number.isInteger(parsed)) {
        return DEFAULT_PORTFOLIO_ACTIVITIES_CONCURRENCY;
    }

    return Math.min(
        Math.max(parsed, MIN_PORTFOLIO_ACTIVITIES_CONCURRENCY),
        MAX_PORTFOLIO_ACTIVITIES_CONCURRENCY
    );
}

function appendRepeatedQueryParams(url: URL, key: string, values: string[] | undefined): void {
    for (const value of values ?? []) {
        const trimmed = value.trim();
        if (trimmed) {
            url.searchParams.append(key, trimmed);
        }
    }
}

async function mapWithConcurrency<TInput, TOutput>(
    items: TInput[],
    concurrency: number,
    mapper: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
    if (items.length === 0) {
        return [];
    }

    if (!Number.isInteger(concurrency) || concurrency < 1) {
        throw new Error(
            `Invalid concurrency limit: ${concurrency}. Expected integer >= 1.`
        );
    }

    const results: TOutput[] = new Array(items.length);
    let nextIndex = 0;

    async function worker(): Promise<void> {
        while (true) {
            const currentIndex = nextIndex;
            nextIndex += 1;

            if (currentIndex >= items.length) {
                return;
            }

            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }

    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    return results;
}

function normalizeFetchActivitiesOptions(options?: FetchActivitiesOptions): Required<FetchActivitiesOptions> {
    const limit = options?.limit ?? DEFAULT_FETCH_ACTIVITIES_OPTIONS.limit ?? DEFAULT_ACTIVITY_PAGE_LIMIT;

    return {
        activityTypes: options?.activityTypes ?? DEFAULT_FETCH_ACTIVITIES_OPTIONS.activityTypes ?? [],
        assetTypes: options?.assetTypes ?? DEFAULT_FETCH_ACTIVITIES_OPTIONS.assetTypes ?? [],
        holdingIds: options?.holdingIds ?? DEFAULT_FETCH_ACTIVITIES_OPTIONS.holdingIds ?? [],
        limit: Math.min(Math.max(Math.floor(limit), 1), DEFAULT_ACTIVITY_PAGE_LIMIT),
    };
}

// Diese Funktion laedt Activities fuer genau ein Portfolio.
// Sie geht alle Seiten ueber den Cursor durch.
// Standardmaessig wird providerseitig auf security-Assets eingeschraenkt,
// weil die aktuelle Asset-Pipeline danach ohnehin nur echte Wertpapieraktivitaeten verarbeitet.
export async function fetchAllActivitiesForPortfolio(
    accessToken: string,
    portfolioId: string,
    options?: FetchActivitiesOptions
): Promise<Activity[]> {
    const fetchOptions = normalizeFetchActivitiesOptions(options);
    const allActivities: Activity[] = [];
    let cursor: string | null = null;

    while (true) {
        const url = new URL(
            `https://connect.parqet.com/portfolios/${portfolioId}/activities`
        );

        url.searchParams.set("limit", String(fetchOptions.limit));
        appendRepeatedQueryParams(url, "activityType", fetchOptions.activityTypes);
        appendRepeatedQueryParams(url, "assetType", fetchOptions.assetTypes);
        appendRepeatedQueryParams(url, "holdingId", fetchOptions.holdingIds);

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

// Diese Funktion laedt Activities fuer mehrere Portfolios.
export async function loadActivitiesForPortfolios(
    accessToken: string,
    portfolioIds: string[],
    options?: FetchActivitiesOptions
): Promise<Activity[]> {
    const results = await mapWithConcurrency(
        portfolioIds,
        getPortfolioActivitiesConcurrency(),
        (portfolioId) => fetchAllActivitiesForPortfolio(accessToken, portfolioId, options)
    );

    return results.flat();
}
