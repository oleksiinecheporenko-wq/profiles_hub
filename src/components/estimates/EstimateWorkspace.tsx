"use client";

import { useState, type ReactNode } from "react";
import clsx from "clsx";
import { Calculator, FileText } from "lucide-react";

export type WorkspaceTab = "description" | "estimate";

const TABS = [
  { key: "description", label: "Опис", icon: FileText },
  { key: "estimate", label: "Оцінка", icon: Calculator },
] as const;

/**
 * `Опис` / `Оцінка`. Both panels stay mounted, so unsaved edits survive switching;
 * the selected tab is mirrored to `?tab=` for reloads and shared links.
 */
export function EstimateWorkspace({
  initialTab,
  description,
  estimate,
}: {
  initialTab: WorkspaceTab;
  description: ReactNode;
  estimate: ReactNode;
}) {
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);

  function select(next: WorkspaceTab) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <div role="tablist" aria-label="Розділи запиту" className="mb-6 flex gap-6 border-b border-line">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = key === tab;
          return (
            <button
              key={key}
              id={`tab-${key}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${key}`}
              onClick={() => select(key)}
              className={clsx(
                "-mb-px inline-flex h-11 cursor-pointer items-center gap-2 border-b-2 text-sm font-medium transition-colors duration-150",
                active ? "border-accent text-fg" : "border-transparent text-fg-2 hover:text-fg",
              )}
            >
              <Icon className={clsx("size-4", active ? "text-accent" : "text-fg-muted")} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
      <div id="panel-description" role="tabpanel" aria-labelledby="tab-description" hidden={tab !== "description"}>
        {description}
      </div>
      <div id="panel-estimate" role="tabpanel" aria-labelledby="tab-estimate" hidden={tab !== "estimate"}>
        {estimate}
      </div>
    </>
  );
}
