import type { Activity } from "./activity-types";

// Diese Funktion prueft, ob eine Activity ein echter Wertpapier-Event ist.
// Wir schliessen hier bewusst Cash-Spiegelungen und Referencing-Eintraege aus.
export function isRealSecurityActivity(activity: Activity): boolean {
    const isin = activity.asset?.isin ?? activity.security?.isin ?? activity.isin;
    const assetIdentifierType = activity.asset?.assetIdentifierType;
    const holdingAssetType = activity.holdingAssetType;
    const id = activity.id || "";

    // Ohne ISIN ist die Activity fuer die Asset-Sicht nicht relevant.
    if (!isin) {
        return false;
    }

    // Wenn das Identifier-Feld vorhanden ist, muss es ISIN sein.
    // Falls es fehlt, verwerfen wir die Activity nicht automatisch.
    if (assetIdentifierType && assetIdentifierType !== "isin") {
        return false;
    }

    // Nur Security-Holdings behalten, falls das Feld vorhanden ist.
    if (holdingAssetType && holdingAssetType !== "security") {
        return false;
    }

    // Spiegelnde Cash-/Referencing-Eintraege ausschliessen.
    if (id.startsWith("cpa_referencing_")) {
        return false;
    }

    return true;
}