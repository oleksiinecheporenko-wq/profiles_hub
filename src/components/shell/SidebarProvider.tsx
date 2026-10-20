"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type SidebarState = {
  /** Effective state: the saved preference, or collapsed while a screen forces it. */
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
  /** Temporarily collapse without touching the saved preference. */
  setForcedCollapse: (value: boolean) => void;
  /** Nav item to highlight on pages outside the section routes (an estimate's own page). */
  activeSection: string | null;
  setActiveSection: (href: string | null) => void;
};

const SidebarContext = createContext<SidebarState | null>(null);
const STORAGE_KEY = "eh.sidebar.collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(false);
  const [forced, setForced] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

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
      activeSection,
      setActiveSection,
    }),
    [collapsed, forced, preference, setCollapsed, activeSection],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return ctx;
}

/** Highlights a nav section while the calling component is mounted. */
export function MarkSection({ href }: { href: string }) {
  const { setActiveSection } = useSidebar();
  useEffect(() => {
    setActiveSection(href);
    return () => setActiveSection(null);
  }, [href, setActiveSection]);
  return null;
}
