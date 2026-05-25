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

function isNormalAppRoute(pathname: string): boolean {
  return !isAdminRoute(pathname) && !isApiRoute(pathname);
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
