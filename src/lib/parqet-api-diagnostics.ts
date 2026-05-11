export type ParqetApiDiagnosticCategory =
  | "missing_access_token"
  | "auth_refresh_failed"
  | "rate_limit"
  | "auth_error"
  | "provider_error"
  | "pipeline_error";

export type ParqetApiDiagnostic = {
  category: ParqetApiDiagnosticCategory;
  retryAfterSeconds?: number | null;
};

export type ParqetApiBudgetInfo = {
  providerCallsMayOccur: boolean;
  activityFetchMayOccur: boolean;
  activityFetchScope: "none" | "selected_portfolios" | "authorized_portfolios" | "unknown";
  responseFlagsReduceProviderCalls: boolean;
  notes: string[];
};

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isLikelyAuthError(error: unknown): boolean {
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  return (
    message.includes("(401)") ||
    message.includes(" 401 ") ||
    message.includes("401:") ||
    lowerMessage.includes("unauthorized")
  );
}

export function getRetryAfterSeconds(message: string): number | null {
  const match = message.match(/try again in\s+(\d+)\s+seconds/i);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function redactProviderErrorMessage(message: string): string {
  return message
    .replace(/portfolio [A-Za-z0-9_-]+/g, "portfolio [redacted]")
    .replace(/portfolios\/[A-Za-z0-9_-]+/g, "portfolios/[redacted]")
    .replace(/hld_[A-Za-z0-9_-]+/g, "hld_[redacted]")
    .replace(/cpa_[A-Za-z0-9_-]+/g, "cpa_[redacted]")
    .slice(0, 500);
}

export function classifyParqetApiError(error: unknown): ParqetApiDiagnostic {
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (message.includes("(429)") || lowerMessage.includes("rate limit")) {
    return { category: "rate_limit", retryAfterSeconds: getRetryAfterSeconds(message) };
  }

  if (isLikelyAuthError(error)) {
    return { category: "auth_error" };
  }

  if (
    message.includes("(500)") ||
    message.includes("(502)") ||
    message.includes("(503)") ||
    message.includes("(504)")
  ) {
    return { category: "provider_error" };
  }

  return { category: "pipeline_error" };
}

export function messageForDiagnostic(diagnostic: ParqetApiDiagnostic): string {
  switch (diagnostic.category) {
    case "missing_access_token":
      return "Die Parqet-Verbindung ist nicht aktiv. Bitte verbinde Parqet erneut.";
    case "auth_refresh_failed":
      return "Die Parqet-Verbindung ist abgelaufen. Bitte verbinde Parqet erneut.";
    case "rate_limit":
      return diagnostic.retryAfterSeconds
        ? `Parqet begrenzt gerade weitere Anfragen. Bitte warte etwa ${diagnostic.retryAfterSeconds} Sekunden, bevor du manuell erneut aktualisierst.`
        : "Parqet begrenzt gerade weitere Anfragen. Bitte warte und versuche es später manuell erneut.";
    case "auth_error":
      return "Die Parqet-Verbindung konnte nicht bestätigt werden. Bitte verbinde Parqet erneut.";
    case "provider_error":
      return "Parqet konnte die angefragten Daten gerade nicht liefern. Bitte versuche es später manuell erneut.";
    case "pipeline_error":
      return "Die geladenen Parqet-Daten konnten nicht vollständig vorbereitet werden. Bitte versuche es später erneut oder prüfe die lokalen Diagnosehinweise.";
  }
}

export function buildActivityScanBudgetInfo(input: {
  activityFetchScope: "selected_portfolios" | "authorized_portfolios" | "unknown";
  responseFlagsReduceProviderCalls?: boolean;
}): ParqetApiBudgetInfo {
  return {
    providerCallsMayOccur: true,
    activityFetchMayOccur: true,
    activityFetchScope: input.activityFetchScope,
    responseFlagsReduceProviderCalls: input.responseFlagsReduceProviderCalls ?? false,
    notes: [
      "This route may fetch portfolio Activities from Parqet before local filtering or aggregation.",
      "Response-size flags do not necessarily reduce upstream provider calls.",
      "Prefer cached data or explicit refresh flows for repeated use.",
    ],
  };
}

export function buildPortfolioHealthBudgetInfo(): ParqetApiBudgetInfo {
  return {
    providerCallsMayOccur: true,
    activityFetchMayOccur: false,
    activityFetchScope: "none",
    responseFlagsReduceProviderCalls: true,
    notes: [
      "This check may call the Parqet portfolios endpoint only.",
      "It does not fetch portfolio Activities.",
      "Use this route for auth/session checks before expensive audits.",
    ],
  };
}
