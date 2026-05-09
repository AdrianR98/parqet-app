import rawOverrides from "../../../data/global-asset-overrides.json";
import type {
  ActivityType,
  AppliedGlobalAssetOverride,
  GlobalAssetKey,
  GlobalAssetOverrideDecisionType,
  NormalizedActivity,
} from "./types";

const QUANTITY_MATCH_EPSILON = 0.000001;

export type GlobalAssetOverrideMatch = {
  activityId?: string | null;
  datetime?: string | null;
  sourceType?: string | null;
  quantity?: number | null;
  portfolioId?: string | null;
};

export type GlobalAssetOverrideEffect = {
  targetActivityType?: ActivityType | "no_position_effect";
  quantityAdjustment?: number;
  affectsPosition?: boolean;
  unblockMetrics?: boolean;
};

export type GlobalAssetOverride = {
  id: string;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
  assetKey: GlobalAssetKey;
  portfolioIdAliasOrReal?: string | null;
  decisionType: GlobalAssetOverrideDecisionType;
  reason: string;
  match?: GlobalAssetOverrideMatch;
  effect?: GlobalAssetOverrideEffect;
};

export type ApplyGlobalAssetOverridesResult = {
  activities: NormalizedActivity[];
  appliedOverrides: AppliedGlobalAssetOverride[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedDecisionType(value: unknown): value is GlobalAssetOverrideDecisionType {
  return (
    typeof value === "string" &&
    [
      "ignore_activity_for_position",
      "reclassify_activity_type",
      "add_manual_quantity_adjustment",
      "mark_as_known_external_issue",
    ].includes(value)
  );
}

function isIsinAssetKey(value: unknown): value is GlobalAssetKey {
  return isRecord(value) && value.type === "isin" && typeof value.value === "string" && value.value.trim().length > 0;
}

function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseMatch(value: unknown): GlobalAssetOverrideMatch | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return undefined;

  return {
    activityId: parseOptionalString(value.activityId),
    datetime: parseOptionalString(value.datetime),
    sourceType: parseOptionalString(value.sourceType),
    quantity: parseOptionalNumber(value.quantity),
    portfolioId: parseOptionalString(value.portfolioId),
  };
}

function parseEffect(value: unknown): GlobalAssetOverrideEffect | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return undefined;

  const targetActivityType = typeof value.targetActivityType === "string"
    ? (value.targetActivityType as GlobalAssetOverrideEffect["targetActivityType"])
    : undefined;

  return {
    targetActivityType,
    quantityAdjustment: parseOptionalNumber(value.quantityAdjustment) ?? undefined,
    affectsPosition: typeof value.affectsPosition === "boolean" ? value.affectsPosition : undefined,
    unblockMetrics: typeof value.unblockMetrics === "boolean" ? value.unblockMetrics : undefined,
  };
}

function assetKeysMatch(left: GlobalAssetKey | null | undefined, right: GlobalAssetKey | null | undefined): boolean {
  return Boolean(left && right && left.type === right.type && left.value === right.value);
}

function quantitiesMatch(left: number | null | undefined, right: number | null | undefined): boolean {
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }

  return Math.abs(left - right) < QUANTITY_MATCH_EPSILON;
}

function hasSpecificMatch(match: GlobalAssetOverrideMatch | undefined): boolean {
  if (!match) return false;

  return Boolean(
    match.activityId ||
    match.datetime ||
    match.sourceType ||
    match.quantity !== undefined ||
    match.portfolioId
  );
}

function activityIdMatches(activity: NormalizedActivity, activityId: string): boolean {
  return activity.ids.internalActivityId === activityId || activity.ids.sourceActivityId === activityId;
}

function overrideMatchesActivity(override: GlobalAssetOverride, activity: NormalizedActivity): boolean {
  if (!assetKeysMatch(override.assetKey, activity.assetIdentity.assetKey)) {
    return false;
  }

  if (!hasSpecificMatch(override.match)) {
    return false;
  }

  if (override.match?.portfolioId && override.match.portfolioId !== activity.portfolioContext.portfolioId) {
    return false;
  }

  if (override.match?.activityId && !activityIdMatches(activity, override.match.activityId)) {
    return false;
  }

  if (override.match?.datetime && override.match.datetime !== activity.datetime) {
    return false;
  }

  if (override.match?.sourceType && override.match.sourceType !== activity.sourceType) {
    return false;
  }

  if (override.match?.quantity !== undefined && !quantitiesMatch(override.match.quantity, activity.quantity)) {
    return false;
  }

  return true;
}

function toAppliedOverride(override: GlobalAssetOverride, activity: NormalizedActivity): AppliedGlobalAssetOverride {
  return {
    overrideId: override.id,
    decisionType: "ignore_activity_for_position",
    assetKey: override.assetKey,
    portfolioId: activity.portfolioContext.portfolioId,
    activityId: activity.ids.internalActivityId,
  };
}

export function parseGlobalAssetOverride(value: unknown): GlobalAssetOverride | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.trim().length === 0) return null;
  if (typeof value.enabled !== "boolean") return null;
  if (typeof value.createdAt !== "string" || value.createdAt.trim().length === 0) return null;
  if (!isIsinAssetKey(value.assetKey)) return null;
  if (!isSupportedDecisionType(value.decisionType)) return null;
  if (typeof value.reason !== "string" || value.reason.trim().length === 0) return null;

  return {
    id: value.id,
    enabled: value.enabled,
    createdAt: value.createdAt,
    updatedAt: parseOptionalString(value.updatedAt) ?? undefined,
    assetKey: {
      type: "isin",
      value: value.assetKey.value.trim().toUpperCase(),
    },
    portfolioIdAliasOrReal: parseOptionalString(value.portfolioIdAliasOrReal),
    decisionType: value.decisionType,
    reason: value.reason,
    match: parseMatch(value.match),
    effect: parseEffect(value.effect),
  };
}

export function loadGlobalAssetOverrides(): GlobalAssetOverride[] {
  if (!Array.isArray(rawOverrides)) return [];

  return rawOverrides.flatMap((override) => {
    const parsed = parseGlobalAssetOverride(override);
    return parsed ? [parsed] : [];
  });
}

export function getEnabledGlobalAssetOverrides(): GlobalAssetOverride[] {
  return loadGlobalAssetOverrides().filter((override) => override.enabled);
}

export function applyGlobalAssetPositionOverrides(
  activities: NormalizedActivity[],
  overrides: GlobalAssetOverride[] = getEnabledGlobalAssetOverrides()
): ApplyGlobalAssetOverridesResult {
  const applicableOverrides = overrides.filter(
    (override) => override.enabled && override.decisionType === "ignore_activity_for_position"
  );

  if (applicableOverrides.length === 0) {
    return { activities, appliedOverrides: [] };
  }

  const appliedOverrides: AppliedGlobalAssetOverride[] = [];
  const nextActivities = activities.map((activity) => {
    const matchingOverride = applicableOverrides.find((override) => overrideMatchesActivity(override, activity));

    if (!matchingOverride) {
      return activity;
    }

    const appliedOverride = toAppliedOverride(matchingOverride, activity);
    appliedOverrides.push(appliedOverride);

    return {
      ...activity,
      positionOverride: {
        ...appliedOverride,
        affectsPosition: false,
      },
    };
  });

  return {
    activities: nextActivities,
    appliedOverrides,
  };
}
