import clsx from "clsx";
import { initials } from "@/lib/format";

type Props = {
  name: string;
  /** Signed URL generated on the server; null shows initials. */
  src?: string | null;
  size?: 24 | 28 | 36 | 64;
  className?: string;
};

const sizeClass: Record<NonNullable<Props["size"]>, string> = {
  24: "size-6 text-[10px]",
  28: "size-7 text-[11px]",
  36: "size-9 text-[13px]",
  64: "size-16 text-xl",
};

export function ProfileAvatar({ name, src, size = 36, className }: Props) {
  return (
    <span
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "border border-line-strong bg-surface-2 font-medium text-fg-2 select-none",
        sizeClass[size],
        className,
      )}
    >
      {src ? (
        // Signed storage URLs are short-lived; next/image caching would outlive them.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
