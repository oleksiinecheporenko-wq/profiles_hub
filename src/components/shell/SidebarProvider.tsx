"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type SidebarState = {
  /** Effective state: the saved preference, or collapsed while a screen forces it. */
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
  /** Temporarily collapse (e.g. `Порівняння`) without touching the saved preference. */
  setForcedCollapse: (value: boolean) => void;
};

const SidebarContext = createContext<SidebarState | null>(null);
const STORAGE_KEY = "upm.sidebar.collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(false);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    try {
      // Restore the remembered preference after hydration; SSR always renders expanded.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === "1") setPreference(true);
    } catch {
      // Storage unavailable: keep the default.
    }
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setForced(false);
    setPreference(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Ignore: the preference is only a convenience.
    }
  }, []);

  const collapsed = forced || preference;

  const value = useMemo<SidebarState>(
    () => ({
      collapsed,
      setCollapsed,
      // Expanding while forced keeps the saved preference; it only lifts the override.
      toggle: () => (forced && !preference ? setForced(false) : setCollapsed(!collapsed)),
      setForcedCollapse: setForced,
    }),
    [collapsed, forced, preference, setCollapsed],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return ctx;
}

/** Collapses the sidebar while the calling component is mounted. */
export function AutoCollapseSidebar() {
  const { setForcedCollapse } = useSidebar();
  useEffect(() => {
    setForcedCollapse(true);
    return () => setForcedCollapse(false);
  }, [setForcedCollapse]);
  return null;
}
