"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { IconButton } from "./Button";
import { useToast } from "./Toast";

export function CopyButton({ value, label = "Копіювати" }: { value: string; label?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      label={copied ? "Скопійовано" : label}
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Не вдалося скопіювати.");
        }
      }}
    >
      {copied ? <Check className="size-4 text-positive" aria-hidden /> : <Copy className="size-4" aria-hidden />}
    </IconButton>
  );
}
