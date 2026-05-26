export const ADMIN_RETURN_PENDING_KEY = "assettrace:admin-return-pending";
export const ADMIN_RETURN_RELOADED_FOR_KEY = "assettrace:admin-return-reloaded-for";
export const ADMIN_RETURN_EXCLUDED_PREFIXES = ["/admin", "/api", "/_next"] as const;
export const ADMIN_RETURN_STATIC_ASSET_REGEX_SOURCE = "\\.(?:css|js|png|jpg|jpeg|gif|svg|ico|webp|avif|map|txt|xml)$";

type ShouldReloadAfterAdminReturnInput = {
  pathname: string;
  pending: string | null;
  reloadedFor: string | null;
};

export type ShouldReloadAfterAdminReturnResult = {
  shouldReload: boolean;
  shouldClearMarker: boolean;
};

const staticAssetLikeRoutePattern = new RegExp(ADMIN_RETURN_STATIC_ASSET_REGEX_SOURCE, "i");

export function isNormalAppRoute(pathname: string): boolean {
  if (!pathname.startsWith("/")) return false;
  if (ADMIN_RETURN_EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  if (staticAssetLikeRoutePattern.test(pathname)) return false;
  return true;
}

export function shouldReloadAfterAdminReturn(
  input: ShouldReloadAfterAdminReturnInput,
): ShouldReloadAfterAdminReturnResult {
  if (!isNormalAppRoute(input.pathname)) {
    return { shouldReload: false, shouldClearMarker: false };
  }

  if (input.pending !== "1") {
    return { shouldReload: false, shouldClearMarker: false };
  }

  if (input.reloadedFor === input.pathname) {
    return { shouldReload: false, shouldClearMarker: true };
  }

  return { shouldReload: true, shouldClearMarker: false };
}

export function buildAdminReturnRestoreScript(): string {
  return `
(() => {
  try {
    const pendingKey = ${JSON.stringify(ADMIN_RETURN_PENDING_KEY)};
    const reloadedForKey = ${JSON.stringify(ADMIN_RETURN_RELOADED_FOR_KEY)};
    const excludedPrefixes = ${JSON.stringify(ADMIN_RETURN_EXCLUDED_PREFIXES)};
    const staticFilePattern = new RegExp(${JSON.stringify(ADMIN_RETURN_STATIC_ASSET_REGEX_SOURCE)}, "i");

    const isReloadablePath = (pathname) => {
      if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
      if (excludedPrefixes.some((prefix) => pathname.startsWith(prefix))) return false;
      if (staticFilePattern.test(pathname)) return false;
      return true;
    };

    const checkAdminReturn = () => {
      try {
        const pathname = window.location.pathname;
        const pending = window.sessionStorage.getItem(pendingKey);
        const reloadedFor = window.sessionStorage.getItem(reloadedForKey);

        if (pending !== "1") return;
        if (!isReloadablePath(pathname)) return;

        if (reloadedFor === pathname) {
          window.sessionStorage.removeItem(pendingKey);
          window.sessionStorage.removeItem(reloadedForKey);
          return;
        }

        window.sessionStorage.setItem(reloadedForKey, pathname);
        window.location.reload();
      } catch (_error) {}
    };

    checkAdminReturn();
    window.setTimeout(checkAdminReturn, 0);
    window.setTimeout(checkAdminReturn, 100);

    window.addEventListener("pageshow", checkAdminReturn);
    window.addEventListener("popstate", () => window.setTimeout(checkAdminReturn, 0));
    window.addEventListener("focus", checkAdminReturn);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkAdminReturn();
    });
  } catch (_error) {}
})();
`;
}
