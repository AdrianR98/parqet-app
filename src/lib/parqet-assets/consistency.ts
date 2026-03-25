import type {
    AssetConsistencyCheck,
    AssetSummary,
    ConsistencyReport,
} from "../types";

const SHARE_TOLERANCE = 0.0000001;
const MONEY_TOLERANCE = 0.01;

// Baut fuer ein einzelnes Asset eine Konsistenzbewertung.
function buildAssetConsistencyCheck(asset: AssetSummary): AssetConsistencyCheck {
    const isNegativeShares = asset.netShares < -SHARE_TOLERANCE;
    const isNegativeCostBasis = asset.remainingCostBasis < -MONEY_TOLERANCE;

    const hasZeroSharesButCostBasis =
        Math.abs(asset.netShares) <= SHARE_TOLERANCE &&
        asset.remainingCostBasis > MONEY_TOLERANCE;

    const hasSharesButNoBuyHistory =
        asset.netShares > SHARE_TOLERANCE &&
        asset.totalBoughtShares <= SHARE_TOLERANCE;

    const soldMoreThanBought =
        asset.totalSoldShares > asset.totalBoughtShares + SHARE_TOLERANCE;

    const warnings: string[] = [];

    if (isNegativeShares) {
        warnings.push("Negativer Bestand rekonstruiert.");
    }

    if (isNegativeCostBasis) {
        warnings.push("Negative Kostenbasis erkannt.");
    }

    if (hasZeroSharesButCostBasis) {
        warnings.push("Bestand ist null, aber Kostenbasis ist noch vorhanden.");
    }

    if (hasSharesButNoBuyHistory) {
        warnings.push("Positiver Bestand ohne erkannte Kaufhistorie.");
    }

    if (soldMoreThanBought) {
        warnings.push("Mehr Stücke verkauft als gekauft.");
    }

    return {
        isin: asset.isin,
        name: asset.name,
        reconstructedNetShares: asset.netShares,
        remainingCostBasis: asset.remainingCostBasis,
        isNegativeShares,
        isNegativeCostBasis,
        hasZeroSharesButCostBasis,
        hasSharesButNoBuyHistory,
        soldMoreThanBought,
        warnings,
    };
}

// Baut den Gesamt-Report fuer alle Assets.
export function buildConsistencyReport(
    assets: AssetSummary[]
): ConsistencyReport {
    const checks = assets.map(buildAssetConsistencyCheck);
    const assetsWithWarnings = checks.filter((check) => check.warnings.length > 0);

    return {
        checkedAssets: checks.length,
        warningCount: assetsWithWarnings.length,
        assetsWithWarnings,
    };
}