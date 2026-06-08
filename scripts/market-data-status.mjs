import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function normalizeIsin(value) {
    return String(value ?? "").replace(/\s+/g, "").toUpperCase();
}

function parseStatusArgs(argv) {
    const options = {
        auditQuality: false,
        all: false,
        isin: null,
    };

    const args = [...argv];
    while (args.length > 0) {
        const token = args.shift();
        if (!token) continue;

        if (token === "--audit-quality") {
            options.auditQuality = true;
            continue;
        }
        if (token === "--all") {
            options.all = true;
            continue;
        }
        if (token === "--isin") {
            const value = normalizeIsin(args.shift());
            if (!/^[A-Z0-9]{12}$/.test(value)) {
                throw new Error("Invalid --isin value.");
            }
            options.isin = value;
            continue;
        }

        throw new Error(`Unknown argument: ${token}`);
    }

    return options;
}

export { parseStatusArgs };

function safeMessage(error) {
    if (error instanceof Error && error.message) return error.message;
    return "Unbekannter Fehler";
}

function isTerminalStatus(status) {
    return status === "excluded" || status === "legacy" || status === "derivative";
}

function toStatusClass(status) {
    if (isTerminalStatus(status)) return "terminal";
    if (status === "unknown") return "manual_review";
    return "actionable";
}

function formatBoolean(value) {
    return value ? "yes" : "no";
}

function isoDateToUtcMs(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(parsed) ? parsed : null;
}

function daysBetween(start, end) {
    const startMs = isoDateToUtcMs(start);
    const endMs = isoDateToUtcMs(end);
    if (startMs === null || endMs === null) return null;
    return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000));
}

function limitRows(rows, maxRows, includeAll) {
    return includeAll ? rows : rows.slice(0, maxRows);
}

function printSectionHeading(title) {
    console.log(title);
}

function printOverflowHint(total, printed, includeAll) {
    if (!includeAll && total > printed) {
        console.log(`- more rows not shown: ${total - printed} (use --all)`);
    }
}

function buildOwnershipIndex(mappings) {
    const map = new Map();
    for (const row of mappings) {
        const key = `${row.provider}::${row.symbol}`;
        const list = map.get(key) ?? [];
        list.push(row);
        map.set(key, list);
    }
    return map;
}

function buildAuditReport({
    instruments,
    mappings,
    primaryPriceQuality,
    dePlan,
    maxRows = 20,
    includeAll = false,
    now = new Date(),
}) {
    const mappingsByIsin = new Map();
    for (const row of mappings) {
        const list = mappingsByIsin.get(row.isin) ?? [];
        list.push(row);
        mappingsByIsin.set(row.isin, list);
    }
    const instrumentByIsin = new Map(instruments.map((row) => [row.isin, row]));
    const qualityByAssetId = new Map(primaryPriceQuality.map((row) => [row.assetId, row]));
    const ownershipByProviderSymbol = buildOwnershipIndex(mappings);

    const remainingNonDeMappings = primaryPriceQuality
        .filter((row) => !row.primarySymbol.endsWith(".DE"))
        .map((row) => {
            const mappingRows = mappingsByIsin.get(row.isin) ?? [];
            const verifiedDeCandidate = mappingRows.find((candidate) => candidate.verifiedAt && candidate.symbol.endsWith(".DE")) ?? null;
            const owners = verifiedDeCandidate
                ? (ownershipByProviderSymbol.get(`${verifiedDeCandidate.provider}::${verifiedDeCandidate.symbol}`) ?? [])
                : [];
            const ownerConflict = verifiedDeCandidate
                ? owners.find((owner) => owner.assetId !== verifiedDeCandidate.assetId) ?? null
                : null;

            return {
                isin: row.isin,
                displayName: row.displayName ?? instrumentByIsin.get(row.isin)?.displayName ?? instrumentByIsin.get(row.isin)?.name ?? "-",
                primarySymbol: row.primarySymbol,
                exchange: row.primaryExchange,
                currency: row.primaryCurrency,
                marketDataStatus: row.marketDataStatus,
                statusClass: toStatusClass(row.marketDataStatus),
                hasVerifiedDeCandidate: Boolean(verifiedDeCandidate),
                verifiedDeSymbol: verifiedDeCandidate?.symbol ?? null,
                verifiedDeMappingId: verifiedDeCandidate?.mappingId ?? null,
                verifiedDeOwnershipStatus: ownerConflict ? "symbol_owned_by_other_asset" : (verifiedDeCandidate ? "owned_by_same_asset" : "no_verified_de_candidate"),
                verifiedDeOwnerAssetId: ownerConflict?.assetId ?? null,
                verifiedDeOwnerIsin: ownerConflict?.isin ?? null,
                verifiedDeOwnerDisplayName: ownerConflict?.displayName ?? null,
                hasDailyPrices: row.priceRowCount > 0,
                latestPriceDate: row.latestPriceDate,
                latestCurrency: row.latestCurrency,
                priceRowCount: row.priceRowCount,
            };
        })
        .sort((a, b) => {
            if (a.statusClass !== b.statusClass) {
                return a.statusClass.localeCompare(b.statusClass);
            }
            return a.isin.localeCompare(b.isin);
        });

    const nonEurLatestPrices = primaryPriceQuality
        .filter((row) => row.latestCurrency && row.latestCurrency.toUpperCase() !== "EUR")
        .map((row) => ({
            isin: row.isin,
            displayName: row.displayName ?? "-",
            primarySymbol: row.primarySymbol,
            latestCurrency: row.latestCurrency,
            latestPriceDate: row.latestPriceDate,
            rowCount: row.priceRowCount,
            marketDataStatus: row.marketDataStatus,
            statusClass: toStatusClass(row.marketDataStatus),
        }))
        .sort((a, b) => a.isin.localeCompare(b.isin));

    const conflictRows = dePlan.switchCandidates
        .map((candidate) => {
            const candidateMapping = mappings.find((row) => row.mappingId === candidate.newPrimaryMappingId) ?? null;
            if (!candidateMapping) return null;
            const owners = ownershipByProviderSymbol.get(`${candidateMapping.provider}::${candidateMapping.symbol}`) ?? [];
            const owner = owners.find((row) => row.assetId !== candidate.assetId) ?? null;
            if (!owner) return null;
            return {
                symbol: candidateMapping.symbol,
                ownerAssetId: owner.assetId,
                ownerIsin: owner.isin,
                ownerDisplayName: owner.displayName ?? "-",
                competingAssetId: candidate.assetId,
                competingIsin: candidate.isin,
                competingDisplayName: candidate.displayName ?? "-",
                reason: "symbol_owned_by_other_asset",
                blocksCurrentActiveOrUnknownAsset: candidate.marketDataStatus === "active" || candidate.marketDataStatus === "unknown",
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.symbol.localeCompare(b.symbol));

    const nowDate = now.toISOString().slice(0, 10);
    const priceHistoryQuality = primaryPriceQuality
        .map((row) => {
            const historyAgeDays = daysBetween(row.latestPriceDate, nowDate);
            const staleLatestPrice = historyAgeDays !== null && historyAgeDays > 7;
            const suspiciouslyShortHistory = row.priceRowCount > 0 && (row.priceRowCount < 252 || (row.minPriceDate && row.minPriceDate > "2024-01-01"));
            const longGapFlag = row.longestGapDays > 10;
            return {
                isin: row.isin,
                displayName: row.displayName ?? "-",
                primarySymbol: row.primarySymbol,
                marketDataStatus: row.marketDataStatus,
                statusClass: toStatusClass(row.marketDataStatus),
                isDePrimary: row.primarySymbol.endsWith(".DE"),
                priceRowCount: row.priceRowCount,
                minPriceDate: row.minPriceDate,
                latestPriceDate: row.latestPriceDate,
                latestCurrency: row.latestCurrency,
                longestGapDays: row.longestGapDays,
                suspiciouslyShortHistory,
                staleLatestPrice,
                longGapFlag,
            };
        })
        .sort((a, b) => {
            const aFlags = Number(a.staleLatestPrice) + Number(a.suspiciouslyShortHistory) + Number(a.longGapFlag);
            const bFlags = Number(b.staleLatestPrice) + Number(b.suspiciouslyShortHistory) + Number(b.longGapFlag);
            if (aFlags !== bFlags) return bFlags - aFlags;
            return a.isin.localeCompare(b.isin);
        });

    const suspiciousHistory = priceHistoryQuality.filter((row) => row.staleLatestPrice || row.suspiciouslyShortHistory || row.longGapFlag);

    return {
        summary: {
            remainingNonDePrimaryMappings: remainingNonDeMappings.length,
            remainingNonDeActionableOrUnknown: remainingNonDeMappings.filter((row) => row.statusClass !== "terminal").length,
            nonEurLatestPrimaryPrices: nonEurLatestPrices.length,
            deOwnershipConflicts: conflictRows.length,
            primaryMappingsAudited: primaryPriceQuality.length,
            dePrimaryMappingsAudited: priceHistoryQuality.filter((row) => row.isDePrimary).length,
            stalePrimaryHistories: priceHistoryQuality.filter((row) => row.staleLatestPrice).length,
            suspiciouslyShortPrimaryHistories: priceHistoryQuality.filter((row) => row.suspiciouslyShortHistory).length,
            longGapPrimaryHistories: priceHistoryQuality.filter((row) => row.longGapFlag).length,
        },
        remainingNonDeMappings,
        nonEurLatestPrices,
        ownershipConflicts: conflictRows,
        priceHistoryQuality,
        suspiciousHistory,
        printed: {
            remainingNonDeMappings: limitRows(remainingNonDeMappings, maxRows, includeAll),
            nonEurLatestPrices: limitRows(nonEurLatestPrices, maxRows, includeAll),
            ownershipConflicts: limitRows(conflictRows, maxRows, includeAll),
            suspiciousHistory: limitRows(suspiciousHistory, maxRows, includeAll),
        },
    };
}

export { buildAuditReport };

function printAuditReport(report, { includeAll }) {
    console.log("Audit Summary");
    console.log(`- remaining primary non-DE mappings: ${report.summary.remainingNonDePrimaryMappings}`);
    console.log(`- remaining primary non-DE actionable/unknown: ${report.summary.remainingNonDeActionableOrUnknown}`);
    console.log(`- primary latest prices with non-EUR currency: ${report.summary.nonEurLatestPrimaryPrices}`);
    console.log(`- verified .DE ownership conflicts: ${report.summary.deOwnershipConflicts}`);
    console.log(`- primary mappings audited: ${report.summary.primaryMappingsAudited}`);
    console.log(`- primary .DE mappings audited: ${report.summary.dePrimaryMappingsAudited}`);
    console.log(`- stale primary histories (>7d): ${report.summary.stalePrimaryHistories}`);
    console.log(`- suspiciously short primary histories: ${report.summary.suspiciouslyShortPrimaryHistories}`);
    console.log(`- primary histories with long gaps (>10d): ${report.summary.longGapPrimaryHistories}`);

    printSectionHeading("Audit: Remaining primary non-DE mappings");
    for (const row of report.printed.remainingNonDeMappings) {
        console.log(`- ${row.isin} | ${row.displayName} | primary=${row.primarySymbol} | exchange=${row.exchange ?? "-"} | currency=${row.currency ?? "-"} | status=${row.marketDataStatus ?? "unset"} | class=${row.statusClass} | has_verified_de=${formatBoolean(row.hasVerifiedDeCandidate)} | de_symbol=${row.verifiedDeSymbol ?? "-"} | de_mapping_id=${row.verifiedDeMappingId ?? "-"} | de_owner_status=${row.verifiedDeOwnershipStatus} | has_prices=${formatBoolean(row.hasDailyPrices)} | latest=${row.latestPriceDate ?? "-"} | latest_currency=${row.latestCurrency ?? "-"} | rows=${row.priceRowCount}`);
    }
    printOverflowHint(report.remainingNonDeMappings.length, report.printed.remainingNonDeMappings.length, includeAll);

    printSectionHeading("Audit: Non-EUR latest primary prices");
    for (const row of report.printed.nonEurLatestPrices) {
        console.log(`- ${row.isin} | ${row.displayName} | primary=${row.primarySymbol} | latest_currency=${row.latestCurrency ?? "-"} | latest=${row.latestPriceDate ?? "-"} | rows=${row.rowCount} | status=${row.marketDataStatus ?? "unset"} | class=${row.statusClass}`);
    }
    printOverflowHint(report.nonEurLatestPrices.length, report.printed.nonEurLatestPrices.length, includeAll);

    printSectionHeading("Audit: Verified .DE ownership conflicts");
    for (const row of report.printed.ownershipConflicts) {
        console.log(`- symbol=${row.symbol} | owner_asset_id=${row.ownerAssetId} | owner_isin=${row.ownerIsin} | owner_name=${row.ownerDisplayName} | competing_asset_id=${row.competingAssetId} | competing_isin=${row.competingIsin} | competing_name=${row.competingDisplayName} | reason=${row.reason} | blocks_active_or_unknown=${formatBoolean(row.blocksCurrentActiveOrUnknownAsset)}`);
    }
    printOverflowHint(report.ownershipConflicts.length, report.printed.ownershipConflicts.length, includeAll);

    printSectionHeading("Audit: Primary price-history quality");
    for (const row of report.printed.suspiciousHistory) {
        console.log(`- ${row.isin} | ${row.displayName} | primary=${row.primarySymbol} | rows=${row.priceRowCount} | min=${row.minPriceDate ?? "-"} | latest=${row.latestPriceDate ?? "-"} | latest_currency=${row.latestCurrency ?? "-"} | longest_gap_days=${row.longestGapDays} | short=${formatBoolean(row.suspiciouslyShortHistory)} | stale=${formatBoolean(row.staleLatestPrice)} | long_gap=${formatBoolean(row.longGapFlag)} | status=${row.marketDataStatus ?? "unset"} | class=${row.statusClass}`);
    }
    printOverflowHint(report.suspiciousHistory.length, report.printed.suspiciousHistory.length, includeAll);
}

export { printAuditReport };

async function closeDbPool() {
    try {
        const { endPostgresPool } = await import("../src/lib/db/postgres-core.ts");
        await endPostgresPool();
    } catch {}
}

async function run() {
    const options = parseStatusArgs(process.argv.slice(2));
    const {
        getMarketDataStatusSummary,
        listMarketInstruments,
        listPrimaryMappingPriceQuality,
        listReferenceSourceCounts,
        listSymbolMappingsForPrimaryPreference,
        listVerifiedMappingsForPromotion,
    } = await import("../src/lib/market-data/db/repository-core.ts");
    const { buildStatusReportTriageSummary } = await import("../src/lib/market-data/db/status-report-triage.ts");
    const { buildDePrimaryPreferencePlan, isGermanYfinanceSymbol } = await import("../src/lib/market-data/prefer-de-primary.ts");

    const summary = await getMarketDataStatusSummary();
    const allInstruments = await listMarketInstruments({ limit: 50000 });
    const sourceCounts = await listReferenceSourceCounts();
    const verifiedMappings = await listVerifiedMappingsForPromotion("yfinance");
    const primaryPreferenceMappings = await listSymbolMappingsForPrimaryPreference("yfinance", options.isin ?? undefined);
    const primaryPriceQuality = options.auditQuality
        ? await listPrimaryMappingPriceQuality("yfinance", options.isin ?? undefined)
        : [];

    const verifiedIsins = new Set(verifiedMappings.map((item) => item.isin));
    const verifiedNonPrimary = verifiedMappings.filter((item) => !item.isPrimary);
    const dePlan = buildDePrimaryPreferencePlan({
        instruments: allInstruments,
        mappings: primaryPreferenceMappings,
    });
    const primaryDeMappings = primaryPreferenceMappings.filter((item) => item.isPrimary && isGermanYfinanceSymbol(item.symbol)).length;
    const primaryNonDeMappings = primaryPreferenceMappings.filter((item) => item.isPrimary && !isGermanYfinanceSymbol(item.symbol)).length;
    const mappingsByIsin = new Map();
    for (const row of primaryPreferenceMappings) {
        const list = mappingsByIsin.get(row.isin) ?? [];
        list.push(row);
        mappingsByIsin.set(row.isin, list);
    }
    const assetsWithVerifiedDeCandidateButNonDePrimary = allInstruments.filter((instrument) => {
        const rows = mappingsByIsin.get(instrument.isin) ?? [];
        const primary = rows.find((row) => row.isPrimary) ?? null;
        if (!primary || isGermanYfinanceSymbol(primary.symbol)) {
            return false;
        }
        return rows.some((row) => row.verifiedAt && isGermanYfinanceSymbol(row.symbol));
    }).length;
    const remainingNonDePrimaryWithoutDeCandidate = allInstruments.filter((instrument) => {
        const rows = mappingsByIsin.get(instrument.isin) ?? [];
        const primary = rows.find((row) => row.isPrimary) ?? null;
        if (!primary || isGermanYfinanceSymbol(primary.symbol)) {
            return false;
        }
        return !rows.some((row) => row.verifiedAt && isGermanYfinanceSymbol(row.symbol));
    }).length;

    console.log("Market Data Status");
    console.log(`- instruments total: ${summary.instrumentsTotal}`);
    console.log(`- mappings total: ${summary.mappingsTotal}`);
    console.log(`- yfinance mappings total: ${summary.yfinanceMappingsTotal}`);
    console.log(`- verified yfinance mappings: ${summary.verifiedYfinanceMappings}`);
    console.log(`- primary yfinance mappings: ${summary.primaryYfinanceMappings}`);
    console.log(`- primary .DE mappings: ${primaryDeMappings}`);
    console.log(`- primary non-DE mappings: ${primaryNonDeMappings}`);
    console.log(`- instruments with at least one verified yfinance mapping: ${summary.instrumentsWithVerifiedYfinance}`);
    console.log(`- instruments without any mapping: ${summary.instrumentsWithoutAnyMapping}`);
    console.log(`- instruments with mapping but no verified mapping: ${summary.instrumentsWithMappingButNoVerifiedYfinance}`);
    console.log(`- instruments with primary mapping: ${summary.instrumentsWithPrimaryYfinance}`);
    console.log(`- instruments without primary mapping: ${summary.instrumentsWithoutPrimaryYfinance}`);
    console.log(`- instruments with daily price data: ${summary.instrumentsWithDailyPrices}`);
    console.log(`- instruments with market actions: ${summary.instrumentsWithActions}`);
    console.log(`- instruments with primary mapping but no price data: ${summary.instrumentsWithPrimaryButNoPrices}`);
    console.log(`- assets with verified .DE candidate but non-DE primary: ${assetsWithVerifiedDeCandidateButNonDePrimary}`);
    console.log(`- assets with switched mapping requiring history replacement: ${dePlan.switchCandidates.filter((item) => item.requiresFullHistoryReplacement).length}`);
    console.log(`- remaining non-DE primary assets without .DE candidate: ${remainingNonDePrimaryWithoutDeCandidate}`);
    console.log(`- failed validation candidates: ${summary.failedValidationCandidates}`);
    console.log(`- instruments with market_data_status=excluded: ${summary.instrumentsStatusExcluded}`);
    console.log(`- instruments with market_data_status=legacy: ${summary.instrumentsStatusLegacy}`);
    console.log(`- instruments with market_data_status=derivative: ${summary.instrumentsStatusDerivative}`);
    console.log(`- instruments with market_data_status=unknown: ${summary.instrumentsStatusUnknown}`);
    console.log(`- instruments with WKN: ${allInstruments.filter((item) => item.wkn && item.wkn.trim()).length}`);
    console.log(`- instruments with display_name: ${allInstruments.filter((item) => item.displayName && item.displayName.trim()).length}`);
    console.log(`- instruments with name_source: ${allInstruments.filter((item) => item.nameSource && item.nameSource.trim()).length}`);
    console.log(`- instruments with display_name_source: ${allInstruments.filter((item) => item.displayNameSource && item.displayNameSource.trim()).length}`);
    console.log(`- instruments with name_source=trading_universe: ${allInstruments.filter((item) => item.nameSource === "trading_universe").length}`);
    console.log(`- instruments with display_name_source=trading_universe: ${allInstruments.filter((item) => item.displayNameSource === "trading_universe").length}`);

    if (sourceCounts.length > 0) {
        console.log("- reference source counts:");
        for (const item of sourceCounts) {
            console.log(`  - ${item.sourceKey}: ${item.rowCount}`);
        }
    }

    const triageSummary = buildStatusReportTriageSummary({
        instruments: allInstruments.map((item) => ({
            isin: item.isin,
            name: item.name,
            marketDataStatus: item.marketDataStatus,
        })),
        verifiedIsins,
    });

    const rawWithoutVerifiedMapping = triageSummary.rawWithoutVerifiedMapping;
    const actionableWithoutVerifiedMapping = triageSummary.actionableWithoutVerifiedMapping;
    const terminalWithoutVerifiedMapping = triageSummary.terminalWithoutVerifiedMapping;
    const manualReviewWithoutVerifiedMapping = triageSummary.manualReviewWithoutVerifiedMapping;
    const classifiedNonActionableManual = terminalWithoutVerifiedMapping.length + manualReviewWithoutVerifiedMapping.length;

    console.log(`- raw instruments without verified yfinance mapping: ${rawWithoutVerifiedMapping.length}`);
    console.log(`- actionable instruments without verified yfinance mapping: ${actionableWithoutVerifiedMapping.length}`);
    console.log(`- terminal instruments without verified yfinance mapping: ${terminalWithoutVerifiedMapping.length}`);
    console.log(`- manual-review (unknown) instruments without verified yfinance mapping: ${manualReviewWithoutVerifiedMapping.length}`);
    console.log(`- terminal breakdown excluded: ${triageSummary.terminalBreakdown.excluded}`);
    console.log(`- terminal breakdown legacy: ${triageSummary.terminalBreakdown.legacy}`);
    console.log(`- terminal breakdown derivative: ${triageSummary.terminalBreakdown.derivative}`);
    console.log(`- terminal/manual-review breakdown unknown: ${manualReviewWithoutVerifiedMapping.length}`);
    console.log(`- open actionable mapping backlog: ${actionableWithoutVerifiedMapping.length}`);
    console.log(`- classified non-actionable/manual cases: ${classifiedNonActionableManual}`);

    if (rawWithoutVerifiedMapping.length > 0) {
        console.log("Top instruments without verified yfinance mapping (raw, includes terminal statuses) (max 20):");
        for (const row of rawWithoutVerifiedMapping.slice(0, 20)) {
            console.log(`- ${row.isin} | ${row.name ?? "-"}`);
        }
    }

    if (actionableWithoutVerifiedMapping.length > 0) {
        console.log("Top actionable instruments without verified yfinance mapping (max 20):");
        for (const row of actionableWithoutVerifiedMapping.slice(0, 20)) {
            console.log(`- ${row.isin} | ${row.name ?? "-"} | ${row.marketDataStatus ?? "unset"}`);
        }
    } else {
        console.log("No actionable unmapped instruments. Run `npm run db:market:unmapped` for detailed open mapping report.");
    }

    const terminalOrManualRows = [...terminalWithoutVerifiedMapping, ...manualReviewWithoutVerifiedMapping];
    if (terminalOrManualRows.length > 0) {
        console.log("Top terminal/manually classified instruments without verified yfinance mapping (max 20):");
        for (const row of terminalOrManualRows.slice(0, 20)) {
            console.log(`- ${row.isin} | ${row.name ?? "-"} | ${row.marketDataStatus ?? "unset"}`);
        }
    }

    if (verifiedNonPrimary.length > 0) {
        console.log("Top verified mappings not primary (max 20):");
        for (const row of verifiedNonPrimary.slice(0, 20)) {
            console.log(`- ${row.isin} | ${row.symbol} | ${row.exchange ?? "-"} | ${row.currency ?? "-"}`);
        }
    }

    console.log("Hint: Run `npm run db:market:unmapped` for a detailed open mapping report (actionable backlog focus).");

    if (options.auditQuality) {
        const filteredInstruments = options.isin
            ? allInstruments.filter((item) => item.isin === options.isin)
            : allInstruments;
        const filteredMappings = options.isin
            ? primaryPreferenceMappings.filter((item) => item.isin === options.isin)
            : primaryPreferenceMappings;
        const filteredDePlan = buildDePrimaryPreferencePlan({
            instruments: filteredInstruments,
            mappings: filteredMappings,
        });
        const report = buildAuditReport({
            instruments: filteredInstruments,
            mappings: filteredMappings,
            primaryPriceQuality,
            dePlan: filteredDePlan,
            maxRows: 20,
            includeAll: options.all,
        });
        printAuditReport(report, { includeAll: options.all });
        console.log("Hint: Run `npm run db:market:status -- --audit-quality --all` for full detail or `--isin <ISIN>` to narrow the audit.");
    }
}

run()
    .catch((error) => {
        console.error(`Statusreport fehlgeschlagen: ${safeMessage(error)}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDbPool();
    });
