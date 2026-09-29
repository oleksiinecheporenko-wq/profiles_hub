"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; message: string };

type ToastApi = {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS: Record<ToastTone, number> = { success: 3500, info: 4000, error: 7000 };

const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
const iconTone = { success: "text-positive", error: "text-negative", info: "text-fg-2" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS[tone]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-6 bottom-6 z-50 flex w-96 flex-col gap-2"
      >
        {items.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className={clsx(
                "pointer-events-auto flex animate-toast-in items-start gap-3 rounded-lg border border-line-strong",
                "bg-surface-2 px-4 py-3 text-sm shadow-[0_12px_32px_rgba(0,0,0,.4)]",
              )}
            >
              <Icon className={clsx("mt-0.5 size-4 shrink-0", iconTone[t.tone])} aria-hidden />
              <p className="flex-1 text-fg">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Закрити повідомлення"
                className="-mr-1 flex size-6 cursor-pointer items-center justify-center rounded text-fg-muted hover:bg-surface-hover hover:text-fg"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
