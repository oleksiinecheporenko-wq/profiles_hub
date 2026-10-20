"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Debounced, serialized saving of the latest value. `schedule` queues a save,
 * `flush` saves now and resolves to false when the save failed.
 */
export function useAutosave<T>(save: (value: T) => Promise<boolean>, delay = 600) {
  const [state, setState] = useState<SaveState>("idle");
  const latest = useRef<{ value: T } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback((): Promise<boolean> => {
    window.clearTimeout(timer.current);
    const pending = latest.current;
    if (!pending) return chain.current;
    latest.current = null;
    chain.current = chain.current.then(async () => {
      setState("saving");
      const ok = await saveRef.current(pending.value);
      setState(ok ? (latest.current ? "saving" : "saved") : "error");
      return ok;
    });
    return chain.current;
  }, []);

  const schedule = useCallback(
    (value: T) => {
      latest.current = { value };
      setState("saving");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, delay);
    },
    [flush, delay],
  );

  // Save what is pending when the component goes away, and warn before leaving the page.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (latest.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      void flush();
    };
  }, [flush]);

  return { state, schedule, flush };
}
