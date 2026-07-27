"use client";

/* -----------------------------------------------------------------------
   useReducedMotion — reactive OS "reduce motion" preference
   ─────────────────────────────────────────────────────────────────────
   Read through useSyncExternalStore so it stays SSR-safe (server snapshot
   is always `false`, matching first client paint → no hydration mismatch)
   and updates live if the visitor toggles the setting — without the
   setState-in-effect anti-pattern.
   ----------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot() {
  return typeof window !== "undefined" && window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
