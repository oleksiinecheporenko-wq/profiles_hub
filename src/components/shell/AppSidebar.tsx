"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Activity,
  FileText,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  Users,
} from "lucide-react";
import { useSidebar } from "./SidebarProvider";

const NAV = [
  { href: "/profiles", label: "Профілі", icon: Users },
  { href: "/status-profiles", label: "Статус профілів", icon: LayoutGrid },
  { href: "/actions", label: "Дії", icon: Activity },
  { href: "/contracts", label: "Контракти", icon: FileText },
] as const;

export function AppSidebar({ mockData }: { mockData: boolean }) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-line bg-sidebar",
        "transition-[width] duration-150 ease-out",
        collapsed ? "w-(--sidebar-collapsed)" : "w-(--sidebar-expanded)",
      )}
    >
      <div className={clsx("flex h-16 items-center border-b border-line", collapsed ? "justify-center" : "px-5")}>
        <Link
          href="/profiles"
          aria-label="Upwork Profile Manager — на головну"
          className="rounded-sm"
        >
          {collapsed ? (
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-md border border-line-strong font-mono text-xs font-semibold tracking-tight"
            >
              U<span className="text-accent">/</span>P
            </span>
          ) : (
            <span aria-hidden className="block">
              <span className="block font-mono text-[13px] font-semibold tracking-wide whitespace-nowrap">
                UPWORK <span className="text-accent">/</span> PROFILE MANAGER
              </span>
              <span className="mt-0.5 block font-mono text-[11px] text-fg-muted">
                {"// internal workspace"}
              </span>
            </span>
          )}
        </Link>
      </div>

      <nav aria-label="Основна навігація" className="flex-1 px-2 py-4">
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? label : undefined}
                  className={clsx(
                    "relative flex h-9 items-center gap-3 rounded-md text-sm transition-colors duration-150",
                    collapsed ? "justify-center" : "px-3",
                    active
                      ? "bg-accent-soft text-fg"
                      : "text-fg-muted hover:bg-surface-hover hover:text-fg",
                  )}
                >
                  {active && (
                    <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />
                  )}
                  <Icon className={clsx("size-4 shrink-0", active && "text-accent")} aria-hidden />
                  {collapsed ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-2">
        {/* Reserved for a future user block. No login exists yet, so no identity is shown. */}
        <div
          aria-hidden
          className={clsx("flex h-10 items-center gap-3 rounded-md", collapsed ? "justify-center" : "px-3")}
        >
          <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-line-strong text-fg-muted">
            <UserRound className="size-3.5" />
          </span>
          {!collapsed && mockData && (
            <span className="rounded-sm border border-warning/30 px-1.5 py-0.5 font-mono text-[11px] text-warning">
              mock data
            </span>
          )}
        </div>
        {collapsed && mockData && (
          <p className="sr-only">Застосунок працює на тестових даних у пам’яті.</p>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Розгорнути меню" : "Згорнути меню"}
          title={collapsed ? "Розгорнути меню" : "Згорнути меню"}
          className={clsx(
            "mt-1 flex h-9 w-full cursor-pointer items-center gap-3 rounded-md text-[13px] text-fg-muted",
            "transition-colors duration-150 hover:bg-surface-hover hover:text-fg",
            collapsed ? "justify-center" : "px-3",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="size-4" aria-hidden />
              Згорнути
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
