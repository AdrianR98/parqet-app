export type AuditSeverity = "Blocker" | "Warning" | "Info";

export type AuditWarning = {
    code: string;
    severity: AuditSeverity;
    message: string;
    source?: string;
    fieldPath?: string;
};

export type AuditFieldNode = {
    type: string;
    optional: boolean;
    count: number;
    children?: Record<string, AuditFieldNode>;
    element?: AuditFieldNode;
};

export type SourceAudit = {
    available: boolean;
    count: number;
    topLevelFields: string[];
    fieldTree: Record<string, AuditFieldNode>;
    sampleShape: Record<string, AuditFieldNode>;
    note?: string;
};

export type ActivityTypeAudit = {
    type: string;
    count: number;
    normalizedCandidate?: string;
};

export type TransferIndicatorAudit = {
    source: string;
    indicator: string;
    fieldPath?: string;
    activityType?: string;
};

export type ApiFieldAudit = {
    generatedAt: string;
    environment: "development" | "production-blocked" | "other-non-production";
    sources: {
        portfolios: SourceAudit;
        activities: SourceAudit;
        holdingsOrAssets: SourceAudit;
    };
    activityTypes: ActivityTypeAudit[];
    fieldPresence: Record<string, string[]>;
    candidateIds: Record<string, string[]>;
    candidateValueFields: Record<string, string[]>;
    transferIndicators: TransferIndicatorAudit[];
    warnings: AuditWarning[];
    nextSteps: string[];
};

const MAX_DEPTH = 4;
const MAX_ARRAY_SAMPLES = 25;

const SENSITIVE_FIELD_PATTERNS = [
    /name/i,
    /email/i,
    /user/i,
    /owner/i,
    /account/i,
    /token/i,
    /secret/i,
    /cookie/i,
    /portfolio.*name/i,
];

const ID_FIELD_PATTERNS = [
    /(^|\.)id$/i,
    /isin/i,
    /wkn/i,
    /symbol/i,
    /ticker/i,
    /asset.*id/i,
    /portfolio.*id/i,
    /activity.*id/i,
];

const VALUE_FIELD_PATTERNS = [
    /amount/i,
    /price/i,
    /tax/i,
    /fee/i,
    /currency/i,
    /gross/i,
    /net/i,
    /quantity/i,
    /shares/i,
];

const TRANSFER_FIELD_PATTERNS = [
    /transfer/i,
    /deposit/i,
    /withdraw/i,
    /source/i,
    /target/i,
    /from/i,
    /to/i,
    /reference/i,
    /counter/i,
];

const NORMALIZED_TYPE_CANDIDATES: Array<[RegExp, string]> = [
    [/buy|purchase|kauf/i, "buy"],
    [/sell|sale|verkauf/i, "sell"],
    [/dividend|dividende/i, "dividend"],
    [/transfer/i, "transfer"],
    [/deposit|einbuch/i, "deposit"],
    [/withdraw|ausbuch/i, "withdrawal"],
    [/fee|gebühr|gebuehr/i, "fee"],
    [/tax|steuer/i, "tax"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDateLikeString(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(value);
}

function classifyValue(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (value instanceof Date) return "date-like string";

    const valueType = typeof value;

    if (valueType === "string" && isDateLikeString(value)) return "date-like string";
    if (valueType === "string") return "string";
    if (valueType === "number") return "number";
    if (valueType === "boolean") return "boolean";
    if (valueType === "object") return "object";

    return valueType;
}

function mergeType(left: string, right: string): string {
    if (left === right) return left;

    const types = new Set([...left.split(" | "), ...right.split(" | ")]);
    return [...types].sort().join(" | ");
}

function mergeFieldTrees(
    left: Record<string, AuditFieldNode>,
    right: Record<string, AuditFieldNode>
): Record<string, AuditFieldNode> {
    const result: Record<string, AuditFieldNode> = {};
    const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);

    for (const key of allKeys) {
        const leftNode = left[key];
        const rightNode = right[key];

        if (leftNode && rightNode) {
            result[key] = mergeNode(leftNode, rightNode);
        } else if (leftNode) {
            result[key] = { ...leftNode, optional: true };
        } else if (rightNode) {
            result[key] = { ...rightNode, optional: true };
        }
    }

    return result;
}

function mergeNode(left: AuditFieldNode | undefined, right: AuditFieldNode): AuditFieldNode {
    if (!left) return right;

    const merged: AuditFieldNode = {
        type: mergeType(left.type, right.type),
        optional: left.optional && right.optional,
        count: left.count + right.count,
    };

    if (left.children || right.children) {
        merged.children = mergeFieldTrees(left.children ?? {}, right.children ?? {});
    }

    if (left.element || right.element) {
        merged.element = mergeNode(
            left.element,
            right.element ?? { type: "unknown", optional: true, count: 0 }
        );
    }

    return merged;
}

function markMissingAsOptional(
    tree: Record<string, AuditFieldNode>,
    presentKeys: Set<string>
): Record<string, AuditFieldNode> {
    const next: Record<string, AuditFieldNode> = {};

    for (const [key, node] of Object.entries(tree)) {
        next[key] = presentKeys.has(key) ? node : { ...node, optional: true };
    }

    return next;
}

function analyzeValue(value: unknown, depth = 0): AuditFieldNode {
    const type = classifyValue(value);
    const node: AuditFieldNode = { type, optional: false, count: 1 };

    if (depth >= MAX_DEPTH) return node;

    if (Array.isArray(value)) {
        let elementNode: AuditFieldNode | undefined;

        for (const element of value.slice(0, MAX_ARRAY_SAMPLES)) {
            elementNode = mergeNode(elementNode, analyzeValue(element, depth + 1));
        }

        if (elementNode) node.element = elementNode;
        return node;
    }

    if (isRecord(value)) {
        node.children = analyzeObject(value, depth + 1);
    }

    return node;
}

function analyzeObject(value: Record<string, unknown>, depth = 0): Record<string, AuditFieldNode> {
    const tree: Record<string, AuditFieldNode> = {};

    for (const [key, childValue] of Object.entries(value)) {
        tree[key] = analyzeValue(childValue, depth);
    }

    return tree;
}

function analyzeItems(items: unknown[]): Record<string, AuditFieldNode> {
    let mergedTree: Record<string, AuditFieldNode> = {};

    for (const item of items.slice(0, MAX_ARRAY_SAMPLES)) {
        if (!isRecord(item)) continue;

        const presentKeys = new Set(Object.keys(item));
        const currentTree = analyzeObject(item);
        mergedTree = mergeFieldTrees(markMissingAsOptional(mergedTree, presentKeys), currentTree);
    }

    return mergedTree;
}

function flattenFieldPaths(tree: Record<string, AuditFieldNode>, prefix = ""): string[] {
    const paths: string[] = [];

    for (const [key, node] of Object.entries(tree)) {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push(path);

        if (node.children) {
            paths.push(...flattenFieldPaths(node.children, path));
        }

        if (node.element?.children) {
            paths.push(...flattenFieldPaths(node.element.children, `${path}[]`));
        }
    }

    return paths.sort();
}

function buildSourceAudit(items: unknown[], note?: string): SourceAudit {
    const fieldTree = analyzeItems(items);

    return {
        available: !note,
        count: items.length,
        topLevelFields: Object.keys(fieldTree).sort(),
        fieldTree,
        sampleShape: fieldTree,
        note,
    };
}

function buildUnavailableSource(note: string): SourceAudit {
    return {
        available: false,
        count: 0,
        topLevelFields: [],
        fieldTree: {},
        sampleShape: {},
        note,
    };
}

function collectMatchingFields(sourceName: string, fieldPaths: string[], patterns: RegExp[]) {
    return {
        [sourceName]: fieldPaths.filter((fieldPath) =>
            patterns.some((pattern) => pattern.test(fieldPath))
        ),
    };
}

function collectSensitiveFieldWarnings(sourceName: string, fieldPaths: string[]): AuditWarning[] {
    return fieldPaths
        .filter((fieldPath) => SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(fieldPath)))
        .map((fieldPath) => ({
            code: "SENSITIVE_FIELD_PRESENT",
            severity: "Info" as const,
            message: "A potentially sensitive field name is present in the audited structure.",
            source: sourceName,
            fieldPath,
        }));
}

function normalizeActivityTypeCandidate(type: string): string | undefined {
    return NORMALIZED_TYPE_CANDIDATES.find(([pattern]) => pattern.test(type))?.[1];
}

function extractActivityType(activity: unknown): string {
    if (!isRecord(activity)) return "unknown";

    const candidate = activity.type ?? activity.activityType ?? activity.kind;
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : "unknown";
}

function buildActivityTypes(activities: unknown[]): ActivityTypeAudit[] {
    const counts = new Map<string, number>();

    for (const activity of activities) {
        const type = extractActivityType(activity);
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }

    return [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([type, count]) => ({
            type,
            count,
            normalizedCandidate: normalizeActivityTypeCandidate(type),
        }));
}

function buildActivityTypeWarnings(activityTypes: ActivityTypeAudit[]): AuditWarning[] {
    return activityTypes
        .filter((activityType) => !activityType.normalizedCandidate)
        .map((activityType) => ({
            code: "UNKNOWN_ACTIVITY_TYPE_CANDIDATE",
            severity: "Warning" as const,
            message: "No safe normalized type candidate exists for this activity type.",
            source: "activities",
            fieldPath: activityType.type,
        }));
}

function buildTransferIndicators(
    sources: Record<string, SourceAudit>,
    activityTypes: ActivityTypeAudit[]
): TransferIndicatorAudit[] {
    const indicators: TransferIndicatorAudit[] = [];

    for (const activityType of activityTypes) {
        if (/transfer|deposit|withdraw|einbuch|ausbuch/i.test(activityType.type)) {
            indicators.push({ source: "activities", indicator: "activity-type", activityType: activityType.type });
        }
    }

    for (const [sourceName, source] of Object.entries(sources)) {
        for (const fieldPath of flattenFieldPaths(source.fieldTree)) {
            if (TRANSFER_FIELD_PATTERNS.some((pattern) => pattern.test(fieldPath))) {
                indicators.push({ source: sourceName, indicator: "field-name", fieldPath });
            }
        }
    }

    return indicators;
}

function mergeRecordArrays(...records: Array<Record<string, string[]>>): Record<string, string[]> {
    return records.reduce<Record<string, string[]>>((result, record) => {
        for (const [key, value] of Object.entries(record)) {
            result[key] = [...new Set([...(result[key] ?? []), ...value])].sort();
        }

        return result;
    }, {});
}

export function buildParqetApiFieldAudit(input: {
    portfolios: unknown[];
    activities: unknown[];
    holdingsOrAssets?: unknown[];
    holdingsOrAssetsNote?: string;
    environment: ApiFieldAudit["environment"];
}): ApiFieldAudit {
    const sources = {
        portfolios: buildSourceAudit(input.portfolios),
        activities: buildSourceAudit(input.activities),
        holdingsOrAssets: input.holdingsOrAssets
            ? buildSourceAudit(input.holdingsOrAssets)
            : buildUnavailableSource(input.holdingsOrAssetsNote ?? "No safe holdings/assets source is available in this audit implementation."),
    };

    const activityTypes = buildActivityTypes(input.activities);
    const fieldPathsBySource = Object.fromEntries(
        Object.entries(sources).map(([sourceName, source]) => [sourceName, flattenFieldPaths(source.fieldTree)])
    ) as Record<string, string[]>;

    const candidateIds = mergeRecordArrays(
        ...Object.entries(fieldPathsBySource).map(([sourceName, fieldPaths]) =>
            collectMatchingFields(sourceName, fieldPaths, ID_FIELD_PATTERNS)
        )
    );

    const candidateValueFields = mergeRecordArrays(
        ...Object.entries(fieldPathsBySource).map(([sourceName, fieldPaths]) =>
            collectMatchingFields(sourceName, fieldPaths, VALUE_FIELD_PATTERNS)
        )
    );

    const fieldPresence = Object.fromEntries(
        Object.entries(fieldPathsBySource).map(([sourceName, fieldPaths]) => [sourceName, fieldPaths])
    );

    const warnings: AuditWarning[] = [
        ...Object.entries(fieldPathsBySource).flatMap(([sourceName, fieldPaths]) =>
            collectSensitiveFieldWarnings(sourceName, fieldPaths)
        ),
        ...buildActivityTypeWarnings(activityTypes),
    ];

    const transferIndicators = buildTransferIndicators(sources, activityTypes);

    return {
        generatedAt: new Date().toISOString(),
        environment: input.environment,
        sources,
        activityTypes,
        fieldPresence,
        candidateIds,
        candidateValueFields,
        transferIndicators,
        warnings,
        nextSteps: [
            "Run this audit locally with ENABLE_PARQET_AUDIT_ROUTES=true after connecting Parqet.",
            "Copy only non-private findings into docs/PARQET_API_AUDIT.md.",
            "Use the findings to draft the Global Asset Timeline ADR.",
        ],
    };
}
