"use client";

import { useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Loader2 } from "lucide-react";
import { uploadProfilePhotoAction } from "@/app/(app)/profiles/[id]/actions";
import { CopyButton } from "@/components/ui/CopyButton";
import { ProfileAvatar } from "@/components/ui/ProfileAvatar";
import { useToast } from "@/components/ui/Toast";
import type { ProfileOverview } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/format";
import { IMAGE_ACCEPT, precheckImage } from "@/lib/upload";
import { StatusBadgeMenu } from "./StatusChange";

/** `compact`: smaller header for `Порівняння`, keeping the name, status and navigation. */
export function ProfileHeader({
  profile,
  photoUrl,
  compact = false,
}: {
  profile: ProfileOverview;
  photoUrl?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

  const upload = (file: File | undefined) => {
    if (!file) return;
    const problem = precheckImage(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    const form = new FormData();
    form.set("photo", file);
    startUpload(async () => {
      const result = await uploadProfilePhotoAction(profile.id, form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Фото оновлено.");
      router.refresh();
    });
  };

  if (compact) {
    return (
      <header className="flex items-center justify-between gap-4 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/profiles"
            aria-label="До списку профілів"
            title="Профілі"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-2 transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <ProfileAvatar name={profile.fullName} src={photoUrl} size={28} />
          <h1 className="truncate text-base font-semibold" title={profile.fullName}>
            {profile.fullName}
          </h1>
          <span className="truncate text-[13px] text-fg-muted" title={profile.title ?? undefined}>
            {profile.title}
          </span>
        </div>
        <StatusBadgeMenu profile={profile} size="sm" />
      </header>
    );
  }

  return (
    <>
      <Link
        href="/profiles"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Профілі
      </Link>

      <header className="flex items-start justify-between gap-6 pb-6">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={uploading}
            aria-label={photoUrl ? "Змінити фото" : "Завантажити фото"}
            title={photoUrl ? "Змінити фото" : "Завантажити фото"}
            className="group relative shrink-0 cursor-pointer rounded-full disabled:cursor-wait"
          >
            <ProfileAvatar name={profile.fullName} src={photoUrl} size={64} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-fg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 group-disabled:opacity-100">
              {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
            </span>
          </button>
          <input
            ref={input}
            type="file"
            accept={IMAGE_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="min-w-0">
            <p className="font-mono text-xs text-fg-muted">{"// profile"}</p>
            <h1 className="mt-1 truncate text-[26px] leading-tight font-semibold tracking-tight" title={profile.fullName}>
              {profile.fullName}
            </h1>
            <p className="mt-1 truncate text-sm text-fg-2" title={profile.title ?? undefined}>
              {profile.title ?? <span className="text-fg-muted">Title не вказано</span>}
            </p>
            {profile.profileUrl && (
              <div className="mt-0.5 flex min-w-0 items-center gap-1">
                <a
                  href={profile.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-mono text-xs text-fg-muted transition-colors hover:text-accent"
                >
                  {profile.profileUrl}
                </a>
                <CopyButton value={profile.profileUrl} label="Копіювати посилання" />
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadgeMenu profile={profile} />
          <p className="font-mono text-xs text-fg-muted">
            Оновлено <time dateTime={profile.lastActivityAt}>{formatDateTime(profile.lastActivityAt)}</time>
          </p>
        </div>
      </header>
    </>
  );
}
