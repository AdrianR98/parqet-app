// src/lib/asset-display.ts

import type { GlobalAssetViewModel } from "./types";

function isNonEmptyDisplayString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim();

  if (!normalized) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  return lowered !== "undefined" && lowered !== "null" && lowered !== "n/a";
}

function pickFirstDisplayString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (isNonEmptyDisplayString(candidate)) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizeIdentifier(value: unknown): string | null {
  if (!isNonEmptyDisplayString(value)) {
    return null;
  }

  return value.trim().toUpperCase();
}

function isIsinLike(value: unknown): value is string {
  if (!isNonEmptyDisplayString(value)) {
    return false;
  }

  return /^[A-Z0-9]{12}$/.test(value.trim().toUpperCase());
}

function getMetadataCandidates(asset: GlobalAssetViewModel): Array<NonNullable<GlobalAssetViewModel["metadata"]>> {
  const candidates: Array<NonNullable<GlobalAssetViewModel["metadata"]>> = [];

  if (asset.metadata && typeof asset.metadata === "object") {
    candidates.push(asset.metadata);
  }

  if (asset.externalMetadata && typeof asset.externalMetadata === "object") {
    candidates.push(asset.externalMetadata);
  }

  if (asset.assetMeta && typeof asset.assetMeta === "object") {
    candidates.push(asset.assetMeta);
  }

  return candidates;
}

export function getAssetSymbol(asset: GlobalAssetViewModel): string | null {
  const directSymbol = pickFirstDisplayString(
    asset.instrument?.primaryMapping?.symbol,
    asset.symbol,
    asset.ticker,
  );

  if (directSymbol) {
    return directSymbol;
  }

  for (const metadata of getMetadataCandidates(asset)) {
    const metadataSymbol = pickFirstDisplayString(metadata.symbol, metadata.ticker);

    if (metadataSymbol) {
      return metadataSymbol;
    }
  }

  return null;
}

export function isMeaningfulSymbol(symbol: string | null, isin: string): boolean {
  const normalizedSymbol = normalizeIdentifier(symbol);
  const normalizedIsin = normalizeIdentifier(isin);
  if (!normalizedSymbol || !normalizedIsin) {
    return false;
  }
  return normalizedSymbol !== normalizedIsin;
}

export function getAuthoritativeTicker(asset: GlobalAssetViewModel): string | null {
  const symbol = pickFirstDisplayString(asset.instrument?.primaryMapping?.symbol, asset.symbol, asset.ticker);
  if (!symbol) {
    return null;
  }

  return isMeaningfulSymbol(symbol, asset.isin) ? symbol : null;
}

export function buildInstrumentSubtitleParts(asset: GlobalAssetViewModel): string[] {
  const parts: string[] = [];
  const isin = pickFirstDisplayString(asset.isin);
  const wkn = getAssetWkn(asset);
  const ticker = getAuthoritativeTicker(asset);

  if (isin) {
    parts.push(`ISIN ${isin}`);
  }
  if (wkn) {
    parts.push(`WKN ${wkn}`);
  }
  if (ticker) {
    parts.push(`TICKER ${ticker}`);
  }

  return parts;
}

export function getAssetWkn(asset: GlobalAssetViewModel): string | null {
  const directWkn = pickFirstDisplayString(asset.instrument?.wkn, asset.wkn);

  if (directWkn) {
    return directWkn;
  }

  for (const metadata of getMetadataCandidates(asset)) {
    const metadataWkn = pickFirstDisplayString(metadata.wkn);

    if (metadataWkn) {
      return metadataWkn;
    }
  }

  return null;
}

export function getAssetDisplayName(asset: GlobalAssetViewModel): string {
  if (isIsinLike(asset.isin) && asset.instrumentMetadataStatus !== "ok") {
    return "Stammdaten fehlen";
  }

  const name = pickFirstDisplayString(asset.instrument?.displayName, asset.instrument?.name, asset.name);
  if (name) {
    return name;
  }

  const symbol = getAssetSymbol(asset);

  if (symbol) {
    return symbol;
  }

  const wkn = getAssetWkn(asset);

  if (wkn) {
    return wkn;
  }

  return "Stammdaten fehlen";
}

export function getAssetSubtitle(asset: GlobalAssetViewModel): string {
  if (isIsinLike(asset.isin) && asset.instrumentMetadataStatus !== "ok") {
    const base = `ISIN ${asset.isin}`;
    if (asset.instrumentMetadataError) {
      return `${base} • ${asset.instrumentMetadataError}`;
    }
    return `${base} • Instrumenten-Stammdaten fehlen`;
  }

  const symbol = getAuthoritativeTicker(asset);
  const wkn = getAssetWkn(asset);

  if (wkn) {
    return `ISIN ${asset.isin} • WKN ${wkn}`;
  }
  if (symbol) {
    return `ISIN ${asset.isin} • TICKER ${symbol}`;
  }
  return `ISIN ${asset.isin}`;
}

export function getAssetLogoUrl(asset: GlobalAssetViewModel): string | null {
  const isin = normalizeIdentifier(asset.isin);
  if (isin && isIsinLike(isin)) {
    return `https://api.elbstream.com/logos/isin/${encodeURIComponent(isin)}?format=webp`;
  }

  const wkn = normalizeIdentifier(getAssetWkn(asset));
  if (wkn) {
    return `https://api.elbstream.com/logos/wkn/${encodeURIComponent(wkn)}?format=webp`;
  }

  const symbol = normalizeIdentifier(getAssetSymbol(asset));
  if (symbol) {
    return `https://api.elbstream.com/logos/symbol/${encodeURIComponent(symbol)}?format=webp`;
  }

  return null;
}

export function getAssetResolvedLogoUrl(asset: GlobalAssetViewModel): string | null {
  for (const metadata of getMetadataCandidates(asset)) {
    const logoUrl = pickFirstDisplayString((metadata as { logoUrl?: unknown }).logoUrl);
    if (logoUrl) {
      return logoUrl;
    }
  }

  const generatedLogoUrl = getAssetLogoUrl(asset);

  if (!isNonEmptyDisplayString(generatedLogoUrl)) {
    return null;
  }

  return generatedLogoUrl;
}

export function getAssetInitials(asset: GlobalAssetViewModel): string {
  const displayName = getAssetDisplayName(asset);

  if (!isNonEmptyDisplayString(displayName)) {
    return "??";
  }

  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    const initials = `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    return initials || "??";
  }

  const compact = displayName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  if (compact.length >= 2) {
    return compact.slice(0, 2);
  }

  if (compact.length === 1) {
    return `${compact}?`;
  }

  return "??";
}
