export const LAST_ROUTE_KEY = "assettrace:last-route";
export const VISITED_ADMIN_ROUTE_KEY = "assettrace:visited-admin-route";
export const SETTINGS_ADMIN_RETURN_RELOADED_KEY =
  "assettrace:settings-admin-return-reloaded";

export function shouldReloadSettingsAfterAdminReturn(input: {
  pathname: string;
  lastRoute: string | null;
  visitedAdmin: string | null;
  alreadyReloaded: string | null;
}): boolean {
  const isSettings = input.pathname.startsWith("/settings");
  const cameFromAdmin =
    input.visitedAdmin === "1" ||
    (typeof input.lastRoute === "string" && input.lastRoute.startsWith("/admin"));
  const hasReloaded = input.alreadyReloaded === "1";

  return isSettings && cameFromAdmin && !hasReloaded;
}
