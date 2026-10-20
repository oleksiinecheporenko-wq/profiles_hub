"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Link2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

/** Clipboard API, or the old selection-based copy where the API is blocked. */
async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) throw new Error("copy failed");
  }
}

/** Copies the absolute URL of an estimate's page. */
export function CopyLinkButton({ estimateId, className }: { estimateId: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function copy() {
    const url = `${window.location.origin}/estimates/${estimateId}`;
    try {
      await writeClipboard(url);
      setCopied(true);
      toast.success("Посилання на картку скопійовано.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не вдалося скопіювати посилання.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Скопіювати посилання на картку"
      title="Скопіювати посилання на картку"
      className={clsx(
        "flex size-8 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors duration-150 hover:bg-surface-hover hover:text-fg",
        className,
      )}
    >
      {copied ? <Check className="size-4 text-positive" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
    </button>
  );
}
