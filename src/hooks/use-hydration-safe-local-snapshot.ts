"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DASHBOARD_CACHE_CHANGED_EVENT } from "../lib/dashboard-cache";

const BROWSER_LOCAL_STATE_CHANGE_EVENT = "assettrace:browser-local-state-change";

type SerializedHydrationSnapshot<T> = {
  hydrated: boolean;
  value: T;
};

function serializeSnapshot<T>(hydrated: boolean, value: T): string {
  return JSON.stringify({ hydrated, value });
}

function subscribeToBrowserLocalState(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(BROWSER_LOCAL_STATE_CHANGE_EVENT, onStoreChange);
  window.addEventListener(DASHBOARD_CACHE_CHANGED_EVENT, onStoreChange);
  window.addEventListener("pageshow", onStoreChange);
  window.addEventListener("focus", onStoreChange);
  document.addEventListener("visibilitychange", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(BROWSER_LOCAL_STATE_CHANGE_EVENT, onStoreChange);
    window.removeEventListener(DASHBOARD_CACHE_CHANGED_EVENT, onStoreChange);
    window.removeEventListener("pageshow", onStoreChange);
    window.removeEventListener("focus", onStoreChange);
    document.removeEventListener("visibilitychange", onStoreChange);
  };
}

export function notifyBrowserLocalStateChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BROWSER_LOCAL_STATE_CHANGE_EVENT));
  }
}

export function useHydrationSafeLocalSnapshot<T>(
  readBrowserSnapshot: () => T,
  readInitialSnapshot: () => T,
) {
  // SSR and the first client render share the neutral snapshot; browser-local state is read after hydration.
  const serializedSnapshot = useSyncExternalStore(
    subscribeToBrowserLocalState,
    () => serializeSnapshot(true, readBrowserSnapshot()),
    () => serializeSnapshot(false, readInitialSnapshot()),
  );

  return useMemo(
    () => JSON.parse(serializedSnapshot) as SerializedHydrationSnapshot<T>,
    [serializedSnapshot],
  );
}
