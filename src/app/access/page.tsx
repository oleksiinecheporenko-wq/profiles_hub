import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getGateConfig, safeNextPath } from "@/lib/access/token";
import { AccessForm } from "./AccessForm";

export const metadata: Metadata = { title: "Доступ" };

export default async function AccessPage(props: PageProps<"/access">) {
  const { next } = await props.searchParams;
  const nextPath = safeNextPath(next);
  const gate = getGateConfig();
  if (!gate.enabled) redirect(nextPath);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-[380px]">
        <p className="font-mono text-[13px] font-semibold tracking-wide">
          UPWORK <span className="text-accent">/</span> PROFILE MANAGER
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-fg-muted">internal workspace</p>
        <div className="mt-8 rounded-lg border border-line bg-surface-1 p-6">
          <h1 className="text-lg font-semibold">Вхід</h1>
          <p className="mt-1 text-sm text-fg-2">Введіть спільний пароль команди.</p>
          <AccessForm next={nextPath} misconfigured={!gate.secret} />
        </div>
      </div>
    </main>
  );
}
