// ============================================================
// src/lib/generated/csv-asset-metadata-report.ts
// ------------------------------------------------------------
// GENERATED FILE - DO NOT EDIT MANUALLY
// Source: Deine Gesamtansicht-20260324-214212.csv
// Generated at: 2026-03-25T18:54:04.823Z
// ============================================================

export type CsvAssetMetadataReport = {
    sourceFileName: string;
    generatedAt: string;
    totalRows: number;
    usableRows: number;
    uniqueIsins: number;
    skippedRowsMissingIdentifier: number;
    skippedRowsInvalidIdentifier: number;
    skippedRowsMissingHoldingName: number;
    conflictingIsins: Array<{
        isin: string;
        existing: string;
        incoming: string;
    }>;
};

export const CSV_ASSET_METADATA_REPORT: CsvAssetMetadataReport = {
    "sourceFileName": "Deine Gesamtansicht-20260324-214212.csv",
    "generatedAt": "2026-03-25T18:54:04.823Z",
    "totalRows": 2960,
    "usableRows": 1741,
    "uniqueIsins": 74,
    "skippedRowsMissingIdentifier": 1158,
    "skippedRowsInvalidIdentifier": 61,
    "skippedRowsMissingHoldingName": 0,
    "conflictingIsins": []
};
