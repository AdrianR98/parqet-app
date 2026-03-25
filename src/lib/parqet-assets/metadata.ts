import type { AssetMetadataByIsin } from "./activity-types";

// OpenFIGI liefert pro Request-Eintrag ein Response-Objekt.
// Uns interessieren hier nur die Felder, die wir wirklich verwenden.
type OpenFigiMappingItem = {
    name?: string;
    ticker?: string;
};

type OpenFigiMappingResponseEntry = {
    data?: OpenFigiMappingItem[];
    error?: string;
};

export async function loadAssetMetadataByIsin(
    isins: string[]
): Promise<AssetMetadataByIsin> {
    const uniqueIsins = Array.from(new Set(isins.filter(Boolean)));

    const result: AssetMetadataByIsin = {};

    // Default-Werte setzen, damit das Frontend immer stabile Felder bekommt.
    for (const isin of uniqueIsins) {
        result[isin] = {
            name: null,
            symbol: null,
            wkn: null,
        };
    }

    if (uniqueIsins.length === 0) {
        return result;
    }

    try {
        // OpenFIGI erwartet ein Array von Mapping-Objekten.
        const body = uniqueIsins.map((isin) => ({
            idType: "ID_ISIN",
            idValue: isin,
        }));

        const res = await fetch("https://api.openfigi.com/v3/mapping", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            console.error("OpenFIGI failed:", await res.text());
            return result;
        }

        const data: OpenFigiMappingResponseEntry[] = await res.json();

        // Antwort ist ein Array in derselben Reihenfolge wie der Request.
        data.forEach((entry, index) => {
            const isin = uniqueIsins[index];
            const first = entry.data?.[0];

            if (!isin || !first) {
                return;
            }

            result[isin] = {
                name: first.name ?? null,
                symbol: first.ticker ?? null,
                wkn: null, // OpenFIGI liefert hier keine WKN
            };
        });

        return result;
    } catch (error) {
        console.error("Metadata fetch error:", error);
        return result;
    }
}