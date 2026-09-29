"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { ToastProvider } from "@/components/ui/Toast";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, useSidebar } from "./SidebarProvider";

function Workspace({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <main
      className={clsx(
        "min-h-screen px-8 pt-7 pb-16 transition-[padding] duration-150 ease-out",
        collapsed ? "pl-[calc(var(--sidebar-collapsed)+32px)]" : "pl-[calc(var(--sidebar-expanded)+32px)]",
      )}
    >
      {children}
    </main>
  );
}

export function AppFrame({ mockData, children }: { mockData: boolean; children: ReactNode }) {
  return (
    <SidebarProvider>
      <ToastProvider>
        <AppSidebar mockData={mockData} />
        <Workspace>{children}</Workspace>
      </ToastProvider>
    </SidebarProvider>
  );
}
