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
        symbol: null,
        currency: null,
        showNonEurPrices: false,
        showSwitchedAssets: false,
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
        if (token === "--symbol") {
            const value = String(args.shift() ?? "").trim().toUpperCase();
            if (!value) {
                throw new Error("Invalid --symbol value.");
            }
            options.symbol = value;
            continue;
        }
        if (token === "--currency") {
            const value = String(args.shift() ?? "").trim().toUpperCase();
            if (!value) {
                throw new Error("Invalid --currency value.");
            }
            options.currency = value;
            continue;
        }
        if (token === "--show-non-eur-prices") {
            options.showNonEurPrices = true;
            continue;
        }
        if (token === "--show-switched-assets") {
            options.showSwitchedAssets = true;
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

function buildReferenceCandidateIndex(referenceCandidates) {
    const byIsin = new Map();
    for (const row of referenceCandidates) {
        const list = byIsin.get(row.isin) ?? [];
        list.push(row);
        byIsin.set(row.isin, list);
    }
    return byIsin;
}

function dedupeStrings(values) {
    return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
}

function matchesShellLikeText(value) {
    const normalized = String(value ?? "").toLowerCase();
    return normalized.includes("shell") || normalized.includes("royal dutch");
}

function classifyAuditCategory({ statusClass, primaryCurrency, hasNonEurHistoricalRows, latestCurrency, reasonNotSwitchable, hasConflict, suspiciousFlags }) {
    if (statusClass === "terminal") return "terminal_ignore";
    if (hasConflict) return "possible_symbol_conflict";
    if (suspiciousFlags) return "possible_stale_data";
    if ((String(primaryCurrency ?? "").toUpperCase() === "EUR") && (hasNonEurHistoricalRows || (latestCurrency && String(latestCurrency).toUpperCase() !== "EUR"))) return "needs_price_rebuild";
    if (hasNonEurHistoricalRows && latestCurrency && String(latestCurrency).toUpperCase() !== "EUR" && reasonNotSwitchable === "no_verified_de_candidate") return "needs_mapping_candidate";
    if (hasNonEurHistoricalRows && latestCurrency && String(latestCurrency).toUpperCase() !== "EUR") return "needs_price_rebuild";
    if (hasNonEurHistoricalRows) return "possible_price_pollution";
    if (reasonNotSwitchable === "venue_only_candidate") return "needs_manual_review";
    return "OK";
}

function getReasonNotSwitchable({ statusClass, planCandidate, hasVerifiedDeCandidate, hasReferenceDeCandidate, verifiedDeOwnershipStatus }) {
    if (statusClass === "terminal") return "terminal_status";
    if (verifiedDeOwnershipStatus === "symbol_owned_by_other_asset") return "symbol_owned_by_other_asset";
    if (planCandidate?.isVenueOnlySwitch) return "venue_only_candidate";
    if (!hasVerifiedDeCandidate && hasReferenceDeCandidate) return "needs_verified_de_candidate";
    if (!hasVerifiedDeCandidate) return "no_verified_de_candidate";
    return "unknown";
}

function rowMatchesFilters(row, options) {
    if (options.isin && row.isin !== options.isin) return false;
    if (options.symbol) {
        const symbols = dedupeStrings([
            row.primarySymbol,
            row.verifiedDeSymbol,
            ...(row.verifiedDeSymbols ?? []),
            ...(row.referenceDeSymbols ?? []),
            row.symbol,
        ]).map((value) => value.toUpperCase());
        if (!symbols.includes(options.symbol)) return false;
    }
    if (options.currency) {
        const currencies = dedupeStrings([
            row.currency,
            row.primaryCurrency,
            row.latestCurrency,
            ...(row.distinctHistoricalCurrencies ?? []),
            ...(row.historicalCurrencies ?? []),
        ]).map((value) => value.toUpperCase());
        if (!currencies.includes(options.currency)) return false;
    }
    return true;
}

function buildAuditReport({
    instruments,
    mappings,
    primaryPriceQuality,
    dePlan,
    referenceCandidates = [],
    maxRows = 20,
    includeAll = false,
    now = new Date(),
    filters = {},
}) {
    const mappingsByIsin = new Map();
    for (const row of mappings) {
        const list = mappingsByIsin.get(row.isin) ?? [];
        list.push(row);
        mappingsByIsin.set(row.isin, list);
    }
    const instrumentByIsin = new Map(instruments.map((row) => [row.isin, row]));
    const ownershipByProviderSymbol = buildOwnershipIndex(mappings);
    const referenceCandidatesByIsin = buildReferenceCandidateIndex(referenceCandidates);
    const switchCandidateByIsin = new Map((dePlan.switchCandidates ?? []).map((row) => [row.isin, row]));
    const metaByIsin = new Map();
    for (const instrument of instruments) {
        const mappingRows = mappingsByIsin.get(instrument.isin) ?? [];
        const refs = referenceCandidatesByIsin.get(instrument.isin) ?? [];
        metaByIsin.set(instrument.isin, {
            verifiedDeSymbols: mappingRows.filter((row) => row.verifiedAt && row.symbol.endsWith(".DE")).map((row) => row.symbol),
            referenceDeSymbols: refs.filter((row) => row.candidateSymbol.endsWith(".DE")).map((row) => row.candidateSymbol),
        });
    }
    const enrichedPrimaryPriceQuality = primaryPriceQuality.map((row) => ({
        ...row,
        ...(metaByIsin.get(row.isin) ?? { verifiedDeSymbols: [], referenceDeSymbols: [] }),
    }));

    const remainingNonDeMappings = enrichedPrimaryPriceQuality
        .filter((row) => !row.primarySymbol.endsWith(".DE"))
        .map((row) => {
            const mappingRows = mappingsByIsin.get(row.isin) ?? [];
            const planCandidate = switchCandidateByIsin.get(row.isin) ?? null;
            const verifiedDeCandidate = mappingRows.find((candidate) => candidate.verifiedAt && candidate.symbol.endsWith(".DE")) ?? null;
            const referenceDeCandidates = (referenceCandidatesByIsin.get(row.isin) ?? []).filter((candidate) => candidate.candidateSymbol.endsWith(".DE"));
            const meta = metaByIsin.get(row.isin) ?? { verifiedDeSymbols: [], referenceDeSymbols: [] };
            const owners = verifiedDeCandidate
                ? (ownershipByProviderSymbol.get(`${verifiedDeCandidate.provider}::${verifiedDeCandidate.symbol}`) ?? [])
                : [];
            const ownerConflict = verifiedDeCandidate
                ? owners.find((owner) => owner.assetId !== verifiedDeCandidate.assetId) ?? null
                : null;
            const statusClass = toStatusClass(row.marketDataStatus);
            const hasNonEurHistoricalRows = row.nonEurPriceRowCount > 0;
            const reasonNotSwitchable = getReasonNotSwitchable({
                statusClass,
                planCandidate,
                hasVerifiedDeCandidate: Boolean(verifiedDeCandidate),
                hasReferenceDeCandidate: referenceDeCandidates.length > 0,
                verifiedDeOwnershipStatus: ownerConflict ? "symbol_owned_by_other_asset" : null,
            });

            return {
                isin: row.isin,
                displayName: row.displayName ?? instrumentByIsin.get(row.isin)?.displayName ?? instrumentByIsin.get(row.isin)?.name ?? "-",
                primarySymbol: row.primarySymbol,
                exchange: row.primaryExchange,
                currency: row.primaryCurrency,
                marketDataStatus: row.marketDataStatus,
                statusClass,
                hasVerifiedDeCandidate: Boolean(verifiedDeCandidate),
                verifiedDeSymbol: verifiedDeCandidate?.symbol ?? null,
                verifiedDeSymbols: meta.verifiedDeSymbols,
                verifiedDeMappingId: verifiedDeCandidate?.mappingId ?? null,
                verifiedDeOwnershipStatus: ownerConflict ? "symbol_owned_by_other_asset" : (verifiedDeCandidate ? "owned_by_same_asset" : "no_verified_de_candidate"),
                verifiedDeOwnerAssetId: ownerConflict?.assetId ?? null,
                verifiedDeOwnerIsin: ownerConflict?.isin ?? null,
                verifiedDeOwnerDisplayName: ownerConflict?.displayName ?? null,
                hasReferenceDeCandidate: referenceDeCandidates.length > 0,
                referenceDeSymbols: meta.referenceDeSymbols,
                hasDailyPrices: row.priceRowCount > 0,
                latestPriceDate: row.latestPriceDate,
                latestCurrency: row.latestCurrency,
                priceRowCount: row.priceRowCount,
                distinctHistoricalCurrencies: row.distinctHistoricalCurrencies,
                nonEurPriceRowCount: row.nonEurPriceRowCount,
                reasonNotSwitchable,
                auditCategory: classifyAuditCategory({
                    statusClass,
                    primaryCurrency: row.primaryCurrency,
                    hasNonEurHistoricalRows,
                    latestCurrency: row.latestCurrency,
                    reasonNotSwitchable,
                    hasConflict: Boolean(ownerConflict),
                    suspiciousFlags: false,
                }),
            };
        })
        .filter((row) => rowMatchesFilters(row, filters))
        .sort((a, b) => {
            if (a.statusClass !== b.statusClass) {
                return a.statusClass.localeCompare(b.statusClass);
            }
            return a.isin.localeCompare(b.isin);
        });

    const nonEurLatestPrices = enrichedPrimaryPriceQuality
        .filter((row) => row.latestCurrency && row.latestCurrency.toUpperCase() !== "EUR")
        .map((row) => ({
            ...(metaByIsin.get(row.isin) ?? { verifiedDeSymbols: [], referenceDeSymbols: [] }),
            isin: row.isin,
            displayName: row.displayName ?? "-",
            primarySymbol: row.primarySymbol,
            primaryCurrency: row.primaryCurrency,
            latestCurrency: row.latestCurrency,
            latestPriceDate: row.latestPriceDate,
            rowCount: row.priceRowCount,
            marketDataStatus: row.marketDataStatus,
            statusClass: toStatusClass(row.marketDataStatus),
            distinctHistoricalCurrencies: row.distinctHistoricalCurrencies,
            nonEurPriceRowCount: row.nonEurPriceRowCount,
            isDePrimary: row.primarySymbol.endsWith(".DE"),
        }))
        .filter((row) => rowMatchesFilters(row, filters))
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
    const priceHistoryQuality = enrichedPrimaryPriceQuality
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
                primaryCurrency: row.primaryCurrency,
                distinctHistoricalCurrencies: row.distinctHistoricalCurrencies,
                nonEurPriceRowCount: row.nonEurPriceRowCount,
                verifiedDeSymbols: row.verifiedDeSymbols,
                referenceDeSymbols: row.referenceDeSymbols,
                suspiciouslyShortHistory,
                staleLatestPrice,
                longGapFlag,
                hasNonEurHistoricalRows: row.nonEurPriceRowCount > 0,
                latestPriceNonEur: Boolean(row.latestCurrency && row.latestCurrency.toUpperCase() !== "EUR"),
            };
        })
        .filter((row) => rowMatchesFilters(row, filters))
        .sort((a, b) => {
            const aFlags = Number(a.staleLatestPrice) + Number(a.suspiciouslyShortHistory) + Number(a.longGapFlag);
            const bFlags = Number(b.staleLatestPrice) + Number(b.suspiciouslyShortHistory) + Number(b.longGapFlag);
            if (aFlags !== bFlags) return bFlags - aFlags;
            return a.isin.localeCompare(b.isin);
        });

    const suspiciousHistory = priceHistoryQuality.filter((row) => row.staleLatestPrice || row.suspiciouslyShortHistory || row.longGapFlag);
    const switchedDeIntegrity = priceHistoryQuality
        .filter((row) => row.isDePrimary)
        .filter((row) => {
            const mappingRows = mappingsByIsin.get(row.isin) ?? [];
            return mappingRows.some((mapping) => !mapping.isPrimary && mapping.verifiedAt && !mapping.symbol.endsWith(".DE"));
        })
        .map((row) => ({
            ...row,
            auditCategory: classifyAuditCategory({
                statusClass: row.statusClass,
                primaryCurrency: row.primaryCurrency,
                hasNonEurHistoricalRows: row.hasNonEurHistoricalRows,
                latestCurrency: row.latestCurrency,
                reasonNotSwitchable: null,
                hasConflict: false,
                suspiciousFlags: row.suspiciouslyShortHistory || row.staleLatestPrice || row.longGapFlag || row.latestPriceNonEur || row.hasNonEurHistoricalRows,
            }),
        }))
        .sort((a, b) => a.isin.localeCompare(b.isin));

    const historicalCurrencyConsistency = enrichedPrimaryPriceQuality
        .map((row) => ({
            verifiedDeSymbols: row.verifiedDeSymbols,
            referenceDeSymbols: row.referenceDeSymbols,
            isin: row.isin,
            displayName: row.displayName ?? "-",
            primarySymbol: row.primarySymbol,
            primaryCurrency: row.primaryCurrency,
            latestCurrency: row.latestCurrency,
            historicalCurrencies: row.distinctHistoricalCurrencies,
            marketDataStatus: row.marketDataStatus,
            statusClass: toStatusClass(row.marketDataStatus),
            isDePrimary: row.primarySymbol.endsWith(".DE"),
        }))
        .filter((row) => rowMatchesFilters(row, filters))
        .sort((a, b) => a.isin.localeCompare(b.isin));

    const nonEurPriceRowsAudit = (() => {
        const byCurrency = new Map();
        const byStatusClass = new Map();
        const byPrimaryMappingCurrency = new Map();
        const topAssets = [];

        for (const row of enrichedPrimaryPriceQuality.filter((entry) => rowMatchesFilters(entry, filters))) {
            if (row.nonEurPriceRowCount <= 0) continue;
            topAssets.push({
                isin: row.isin,
                displayName: row.displayName ?? "-",
                primarySymbol: row.primarySymbol,
                marketDataStatus: row.marketDataStatus,
                statusClass: toStatusClass(row.marketDataStatus),
                primaryCurrency: row.primaryCurrency,
                latestCurrency: row.latestCurrency,
                nonEurPriceRowCount: row.nonEurPriceRowCount,
                historicalCurrencies: row.distinctHistoricalCurrencies,
                isDePrimary: row.primarySymbol.endsWith(".DE"),
                verifiedDeSymbols: row.verifiedDeSymbols,
                referenceDeSymbols: row.referenceDeSymbols,
            });
            byStatusClass.set(toStatusClass(row.marketDataStatus), (byStatusClass.get(toStatusClass(row.marketDataStatus)) ?? 0) + row.nonEurPriceRowCount);
            byPrimaryMappingCurrency.set(row.primaryCurrency ?? "-", (byPrimaryMappingCurrency.get(row.primaryCurrency ?? "-") ?? 0) + row.nonEurPriceRowCount);
            for (const [currency, count] of Object.entries(row.priceCurrencyBreakdown ?? {})) {
                if (currency.toUpperCase() === "EUR") continue;
                byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + count);
            }
        }

        topAssets.sort((a, b) => b.nonEurPriceRowCount - a.nonEurPriceRowCount || a.isin.localeCompare(b.isin));
        const totalNonEurRows = Array.from(byCurrency.values()).reduce((sum, value) => sum + value, 0);
        return {
            totalNonEurRows,
            byCurrency: Array.from(byCurrency.entries()).sort((a, b) => b[1] - a[1]).map(([currency, rowCount]) => ({ currency, rowCount })),
            byStatusClass: Array.from(byStatusClass.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([statusClass, rowCount]) => ({ statusClass, rowCount })),
            byPrimaryMappingCurrency: Array.from(byPrimaryMappingCurrency.entries()).sort((a, b) => b[1] - a[1]).map(([primaryCurrency, rowCount]) => ({ primaryCurrency, rowCount })),
            topAssets,
        };
    })();

    const shellAudit = (() => {
        const shellRows = enrichedPrimaryPriceQuality
            .filter((row) => {
                const mappingRows = mappingsByIsin.get(row.isin) ?? [];
                const references = referenceCandidatesByIsin.get(row.isin) ?? [];
                return matchesShellLikeText(row.displayName)
                    || matchesShellLikeText(instrumentByIsin.get(row.isin)?.name)
                    || mappingRows.some((mapping) => matchesShellLikeText(mapping.displayName) || ["R6C0.DE", "SHEL.L"].includes(mapping.symbol))
                    || references.some((candidate) => matchesShellLikeText(candidate.name) || candidate.candidateSymbol === "R6C0.DE");
            })
            .map((row) => {
                const mappingRows = mappingsByIsin.get(row.isin) ?? [];
                const verifiedDeMappings = mappingRows.filter((mapping) => mapping.verifiedAt && mapping.symbol.endsWith(".DE"));
                const referenceDeCandidates = (referenceCandidatesByIsin.get(row.isin) ?? []).filter((candidate) => candidate.candidateSymbol.endsWith(".DE"));
                const ownershipConflicts = verifiedDeMappings.flatMap((mapping) =>
                    (ownershipByProviderSymbol.get(`${mapping.provider}::${mapping.symbol}`) ?? [])
                        .filter((owner) => owner.assetId !== mapping.assetId)
                        .map((owner) => ({
                            symbol: mapping.symbol,
                            ownerAssetId: owner.assetId,
                            ownerIsin: owner.isin,
                            ownerDisplayName: owner.displayName ?? "-",
                        })),
                );
                const couldUseR6c0 = verifiedDeMappings.some((mapping) => mapping.symbol === "R6C0.DE") && ownershipConflicts.every((conflict) => conflict.symbol !== "R6C0.DE");
                return {
                    assetId: row.assetId,
                    isin: row.isin,
                    displayName: row.displayName ?? "-",
                    marketDataStatus: row.marketDataStatus,
                    statusClass: toStatusClass(row.marketDataStatus),
                    primarySymbol: row.primarySymbol,
                    primaryExchange: row.primaryExchange,
                    primaryCurrency: row.primaryCurrency,
                    latestPriceDate: row.latestPriceDate,
                    latestCurrency: row.latestCurrency,
                    historicalCurrencies: row.distinctHistoricalCurrencies,
                    priceRowCount: row.priceRowCount,
                    verifiedDeMappings: verifiedDeMappings.map((mapping) => mapping.symbol),
                    referenceDeCandidates: referenceDeCandidates.map((candidate) => candidate.candidateSymbol),
                    ownershipConflicts,
                    safelyUsableR6c0De: couldUseR6c0,
                    blockedReason: couldUseR6c0 ? null : (referenceDeCandidates.some((candidate) => candidate.candidateSymbol === "R6C0.DE") ? "needs_verified_mapping_or_conflict_resolution" : "missing_verified_de_candidate"),
                };
            })
            .filter((row) => rowMatchesFilters(row, filters))
            .sort((a, b) => a.isin.localeCompare(b.isin));

        const relevantSymbols = ["R6C0.DE", "SHEL.L"];
        const symbolOwnership = relevantSymbols.map((symbol) => {
            const owners = ownershipByProviderSymbol.get(`yfinance::${symbol}`) ?? [];
            return owners.map((owner) => {
                const quality = enrichedPrimaryPriceQuality.find((row) => row.assetId === owner.assetId) ?? null;
                const references = referenceCandidates.filter((candidate) => candidate.candidateSymbol === symbol);
                return {
                    symbol,
                    ownerAssetId: owner.assetId,
                    ownerIsin: owner.isin,
                    ownerDisplayName: owner.displayName ?? "-",
                    ownerStatus: owner.marketDataStatus ?? null,
                    ownerPrimarySymbol: owner.isPrimary ? owner.symbol : (quality?.primarySymbol ?? null),
                    ownerPriceRowCount: quality?.priceRowCount ?? 0,
                    ownerLatestPriceDate: quality?.latestPriceDate ?? null,
                    ownerLatestCurrency: quality?.latestCurrency ?? null,
                    competingReferenceIsins: references.map((candidate) => candidate.isin),
                    recommendedHandling: symbol === "R6C0.DE"
                        ? "review symbol ownership against active Shell row before any manual verification"
                        : "keep existing non-DE mapping unless a verified EUR candidate is prepared",
                };
            });
        }).flat().filter((row) => rowMatchesFilters(row, filters));

        return { shellRows, symbolOwnership };
    })();

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
            switchedDeAssetsAudited: switchedDeIntegrity.length,
            switchedDeAssetsWithNonEurHistoricalRows: switchedDeIntegrity.filter((row) => row.hasNonEurHistoricalRows).length,
            switchedDeAssetsWithNonEurLatestPrices: switchedDeIntegrity.filter((row) => row.latestPriceNonEur).length,
            nonEurPriceRowsTotal: nonEurPriceRowsAudit.totalNonEurRows,
            shellRows: shellAudit.shellRows.length,
        },
        remainingNonDeMappings,
        nonEurLatestPrices,
        ownershipConflicts: conflictRows,
        priceHistoryQuality,
        suspiciousHistory,
        switchedDeIntegrity,
        historicalCurrencyConsistency,
        nonEurPriceRowsAudit,
        shellAudit,
        printed: {
            remainingNonDeMappings: limitRows(remainingNonDeMappings, maxRows, includeAll),
            nonEurLatestPrices: limitRows(nonEurLatestPrices, maxRows, includeAll),
            ownershipConflicts: limitRows(conflictRows, maxRows, includeAll),
            suspiciousHistory: limitRows(suspiciousHistory, maxRows, includeAll),
            switchedDeIntegrity: limitRows(switchedDeIntegrity, maxRows, includeAll),
            historicalCurrencyConsistency: limitRows(historicalCurrencyConsistency, maxRows, includeAll),
            nonEurTopAssets: limitRows(nonEurPriceRowsAudit.topAssets, maxRows, includeAll),
            shellRows: limitRows(shellAudit.shellRows, maxRows, includeAll),
            symbolOwnership: limitRows(shellAudit.symbolOwnership, maxRows, includeAll),
        },
    };
}

export { buildAuditReport };

function printAuditReport(report, { includeAll, options = {} }) {
    console.log("Audit Summary");
    console.log(`- remaining primary non-DE mappings: ${report.summary.remainingNonDePrimaryMappings}`);
    console.log(`- remaining primary non-DE actionable/unknown: ${report.summary.remainingNonDeActionableOrUnknown}`);
    console.log(`- primary latest prices with non-EUR currency: ${report.summary.nonEurLatestPrimaryPrices}`);
    console.log(`- verified .DE ownership conflicts: ${report.summary.deOwnershipConflicts}`);
    console.log(`- primary mappings audited: ${report.summary.primaryMappingsAudited}`);
    console.log(`- primary .DE mappings audited: ${report.summary.dePrimaryMappingsAudited}`);
    console.log(`- switched .DE assets audited: ${report.summary.switchedDeAssetsAudited}`);
    console.log(`- switched .DE assets with non-EUR historical rows: ${report.summary.switchedDeAssetsWithNonEurHistoricalRows}`);
    console.log(`- switched .DE assets with non-EUR latest prices: ${report.summary.switchedDeAssetsWithNonEurLatestPrices}`);
    console.log(`- total non-EUR price rows across primary assets: ${report.summary.nonEurPriceRowsTotal}`);
    console.log(`- shell-like rows audited: ${report.summary.shellRows}`);
    console.log(`- stale primary histories (>7d): ${report.summary.stalePrimaryHistories}`);
    console.log(`- suspiciously short primary histories: ${report.summary.suspiciouslyShortPrimaryHistories}`);
    console.log(`- primary histories with long gaps (>10d): ${report.summary.longGapPrimaryHistories}`);

    if (!options.showNonEurPrices && !options.showSwitchedAssets) {
        printSectionHeading("Audit: Remaining primary non-DE mappings");
        for (const row of report.printed.remainingNonDeMappings) {
            console.log(`- ${row.isin} | ${row.displayName} | primary=${row.primarySymbol} | exchange=${row.exchange ?? "-"} | currency=${row.currency ?? "-"} | status=${row.marketDataStatus ?? "unset"} | class=${row.statusClass} | has_verified_de=${formatBoolean(row.hasVerifiedDeCandidate)} | has_reference_de=${formatBoolean(row.hasReferenceDeCandidate)} | de_symbol=${row.verifiedDeSymbol ?? "-"} | de_mapping_id=${row.verifiedDeMappingId ?? "-"} | de_owner_status=${row.verifiedDeOwnershipStatus} | reason=${row.reasonNotSwitchable} | latest=${row.latestPriceDate ?? "-"} | latest_currency=${row.latestCurrency ?? "-"} | historical_currencies=${row.distinctHistoricalCurrencies.join(",") || "-"} | non_eur_rows=${row.nonEurPriceRowCount} | rows=${row.priceRowCount} | category=${row.auditCategory}`);
        }
        printOverflowHint(report.remainingNonDeMappings.length, report.printed.remainingNonDeMappings.length, includeAll);

        printSectionHeading("Audit: Non-EUR latest primary prices");
        for (const row of report.printed.nonEurLatestPrices) {
            console.log(`- ${row.isin} | ${row.displayName} | primary=${row.primarySymbol} | primary_currency=${row.primaryCurrency ?? "-"} | latest_currency=${row.latestCurrency ?? "-"} | latest=${row.latestPriceDate ?? "-"} | historical_currencies=${row.distinctHistoricalCurrencies.join(",") || "-"} | non_eur_rows=${row.nonEurPriceRowCount} | rows=${row.rowCount} | is_de_primary=${formatBoolean(row.isDePrimary)} | status=${row.marketDataStatus ?? "unset"} | class=${row.statusClass}`);
        }
        printOverflowHint(report.nonEurLatestPrices.length, report.printed.nonEurLatestPrices.length, includeAll);

        printSectionHeading("Audit: Verified .DE ownership conflicts");
        for (const row of report.printed.ownershipConflicts) {
            console.log(`- symbol=${row.symbol} | owner_asset_id=${row.ownerAssetId} | owner_isin=${row.ownerIsin} | owner_name=${row.ownerDisplayName} | competing_asset_id=${row.competingAssetId} | competing_isin=${row.competingIsin} | competing_name=${row.competingDisplayName} | reason=${row.reason} | blocks_active_or_unknown=${formatBoolean(row.blocksCurrentActiveOrUnknownAsset)}`);
        }
        printOverflowHint(report.ownershipConflicts.length, report.printed.ownershipConflicts.length, includeAll);

        printSectionHeading("Audit: Price currency consistency by primary mapping");
        for (const row of report.printed.historicalCurrencyConsistency) {
            console.log(`- ${row.isin} | ${row.displayName} | primary=${row.primarySymbol} | primary_currency=${row.primaryCurrency ?? "-"} | latest_currency=${row.latestCurrency ?? "-"} | historical_currencies=${row.historicalCurrencies.join(",") || "-"} | is_de_primary=${formatBoolean(row.isDePrimary)} | status=${row.marketDataStatus ?? "unset"} | class=${row.statusClass}`);
        }
        printOverflowHint(report.historicalCurrencyConsistency.length, report.printed.historicalCurrencyConsistency.length, includeAll);
    }

    if (!options.showNonEurPrices || options.showNonEurPrices) {
        printSectionHeading("Audit: Non-EUR price rows");
        console.log(`- total_non_eur_price_rows=${report.nonEurPriceRowsAudit.totalNonEurRows}`);
        console.log(`- by_currency=${report.nonEurPriceRowsAudit.byCurrency.map((row) => `${row.currency}:${row.rowCount}`).join(",") || "-"}`);
        console.log(`- by_status_class=${report.nonEurPriceRowsAudit.byStatusClass.map((row) => `${row.statusClass}:${row.rowCount}`).join(",") || "-"}`);
        console.log(`- by_primary_mapping_currency=${report.nonEurPriceRowsAudit.byPrimaryMappingCurrency.map((row) => `${row.primaryCurrency}:${row.rowCount}`).join(",") || "-"}`);
        for (const row of report.printed.nonEurTopAssets) {
            console.log(`- ${row.isin} | ${row.displayName} | primary=${row.primarySymbol} | primary_currency=${row.primaryCurrency ?? "-"} | latest_currency=${row.latestCurrency ?? "-"} | historical_currencies=${row.historicalCurrencies.join(",") || "-"} | non_eur_rows=${row.nonEurPriceRowCount} | is_de_primary=${formatBoolean(row.isDePrimary)} | status=${row.marketDataStatus ?? "unset"} | class=${row.statusClass}`);
        }
        printOverflowHint(report.nonEurPriceRowsAudit.topAssets.length, report.printed.nonEurTopAssets.length, includeAll);
    }

    if (!options.showNonEurPrices || !options.showSwitchedAssets || options.showSwitchedAssets) {
        printSectionHeading("Audit: Switched .DE asset integrity");
        for (const row of report.printed.switchedDeIntegrity) {
            console.log(`- ${row.isin} | ${row.displayName} | primary=${row.primarySymbol} | primary_currency=${row.primaryCurrency ?? "-"} | latest_currency=${row.latestCurrency ?? "-"} | historical_currencies=${row.distinctHistoricalCurrencies.join(",") || "-"} | rows=${row.priceRowCount} | min=${row.minPriceDate ?? "-"} | max=${row.latestPriceDate ?? "-"} | longest_gap_days=${row.longestGapDays} | non_eur_history=${formatBoolean(row.hasNonEurHistoricalRows)} | non_eur_latest=${formatBoolean(row.latestPriceNonEur)} | short=${formatBoolean(row.suspiciouslyShortHistory)} | category=${row.auditCategory}`);
        }
        printOverflowHint(report.switchedDeIntegrity.length, report.printed.switchedDeIntegrity.length, includeAll);
    }

    printSectionHeading("Audit: Shell-specific");
    for (const row of report.printed.shellRows) {
        console.log(`- asset_id=${row.assetId} | isin=${row.isin} | name=${row.displayName} | status=${row.marketDataStatus ?? "unset"} | class=${row.statusClass} | primary=${row.primarySymbol} | exchange=${row.primaryExchange ?? "-"} | primary_currency=${row.primaryCurrency ?? "-"} | latest_currency=${row.latestCurrency ?? "-"} | latest=${row.latestPriceDate ?? "-"} | historical_currencies=${row.historicalCurrencies.join(",") || "-"} | rows=${row.priceRowCount} | verified_de=${row.verifiedDeMappings.join(",") || "-"} | reference_de=${row.referenceDeCandidates.join(",") || "-"} | safe_r6c0_de=${formatBoolean(row.safelyUsableR6c0De)} | blocked_reason=${row.blockedReason ?? "-"}`);
    }
    printOverflowHint(report.shellAudit.shellRows.length, report.printed.shellRows.length, includeAll);

    printSectionHeading("Audit: Symbol ownership");
    for (const row of report.printed.symbolOwnership) {
        console.log(`- symbol=${row.symbol} | owner_asset_id=${row.ownerAssetId} | owner_isin=${row.ownerIsin} | owner_name=${row.ownerDisplayName} | owner_status=${row.ownerStatus ?? "unset"} | owner_primary=${row.ownerPrimarySymbol ?? "-"} | owner_rows=${row.ownerPriceRowCount} | owner_latest=${row.ownerLatestPriceDate ?? "-"} | owner_latest_currency=${row.ownerLatestCurrency ?? "-"} | competing_reference_isins=${row.competingReferenceIsins.join(",") || "-"} | recommended=${row.recommendedHandling}`);
    }
    printOverflowHint(report.shellAudit.symbolOwnership.length, report.printed.symbolOwnership.length, includeAll);

    printSectionHeading("Audit: Primary price-history quality");
    for (const row of report.printed.suspiciousHistory) {
        console.log(`- ${row.isin} | ${row.displayName} | primary=${row.primarySymbol} | rows=${row.priceRowCount} | min=${row.minPriceDate ?? "-"} | latest=${row.latestPriceDate ?? "-"} | primary_currency=${row.primaryCurrency ?? "-"} | latest_currency=${row.latestCurrency ?? "-"} | historical_currencies=${row.distinctHistoricalCurrencies.join(",") || "-"} | non_eur_rows=${row.nonEurPriceRowCount} | longest_gap_days=${row.longestGapDays} | short=${formatBoolean(row.suspiciouslyShortHistory)} | stale=${formatBoolean(row.staleLatestPrice)} | long_gap=${formatBoolean(row.longGapFlag)} | non_eur_history=${formatBoolean(row.hasNonEurHistoricalRows)} | non_eur_latest=${formatBoolean(row.latestPriceNonEur)} | status=${row.marketDataStatus ?? "unset"} | class=${row.statusClass}`);
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
        listXetraReferenceCandidates,
        listVerifiedMappingsForPromotion,
    } = await import("../src/lib/market-data/db/repository-core.ts");
    const { buildStatusReportTriageSummary } = await import("../src/lib/market-data/db/status-report-triage.ts");
    const { buildDePrimaryPreferencePlan, isGermanYfinanceSymbol } = await import("../src/lib/market-data/prefer-de-primary.ts");

    const summary = await getMarketDataStatusSummary();
    const allInstruments = await listMarketInstruments({ limit: 50000 });
    const sourceCounts = await listReferenceSourceCounts();
    const verifiedMappings = await listVerifiedMappingsForPromotion("yfinance");
    const primaryPreferenceMappings = await listSymbolMappingsForPrimaryPreference("yfinance", options.isin ?? undefined);
    const referenceCandidates = options.auditQuality
        ? await listXetraReferenceCandidates({ isin: options.isin ?? undefined, limit: 10000 })
        : [];
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
            referenceCandidates,
            maxRows: 20,
            includeAll: options.all,
            filters: options,
        });
        printAuditReport(report, { includeAll: options.all, options });
        console.log("Hint: Run `npm run db:market:status -- --audit-quality --all` for full detail, `--isin <ISIN>` to narrow, or `--symbol <SYMBOL>` / `--currency <CURRENCY>` for focused review.");
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
