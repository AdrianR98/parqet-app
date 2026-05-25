export const ADMIN_RETURN_PENDING_KEY = "assettrace:admin-return-pending";
export const ADMIN_RETURN_RELOADED_FOR_KEY = "assettrace:admin-return-reloaded-for";

type ShouldReloadAfterAdminReturnInput = {
  pathname: string;
  pending: string | null;
  reloadedFor: string | null;
};

export type ShouldReloadAfterAdminReturnResult = {
  shouldReload: boolean;
  shouldClearMarker: boolean;
};

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api");
}

function isInternalFrameworkRoute(pathname: string): boolean {
  return pathname.startsWith("/_next");
}

function isStaticAssetLikeRoute(pathname: string): boolean {
  return /\.(?:css|js|png|jpg|jpeg|gif|svg|ico|webp|avif|map|txt|xml)$/i.test(pathname);
}

export function isNormalAppRoute(pathname: string): boolean {
  if (!pathname.startsWith("/")) return false;
  if (isAdminRoute(pathname)) return false;
  if (isApiRoute(pathname)) return false;
  if (isInternalFrameworkRoute(pathname)) return false;
  if (isStaticAssetLikeRoute(pathname)) return false;
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
