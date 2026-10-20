import clsx from "clsx";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { SaveState } from "./useAutosave";

export function SaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  if (state === "idle") return null;
  return (
    <span
      role="status"
      className={clsx(
        "inline-flex items-center gap-1.5 text-[13px]",
        state === "error" ? "text-negative" : "text-fg-muted",
        className,
      )}
    >
      {state === "saving" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {state === "saved" && <Check className="size-3.5 text-positive" aria-hidden />}
      {state === "error" && <AlertCircle className="size-3.5" aria-hidden />}
      {state === "saving" ? "Зберігаю…" : state === "saved" ? "Збережено" : "Не збережено"}
    </span>
  );
}
