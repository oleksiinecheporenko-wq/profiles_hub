import Link from "next/link";
import clsx from "clsx";

export type TabItem = { key: string; label: string; href: string };

type Props = {
  label: string;
  items: TabItem[];
  activeKey: string;
  /** `primary` — underline tabs of a page; `secondary` — smaller nested tabs. */
  variant?: "primary" | "secondary";
  className?: string;
};

/** Link-based tabs, so the selected tab lives in the URL and survives back navigation. */
export function Tabs({ label, items, activeKey, variant = "primary", className }: Props) {
  const primary = variant === "primary";
  return (
    <nav aria-label={label} className={clsx(primary && "border-b border-line", className)}>
      <ul className={clsx("flex", primary ? "gap-6" : "gap-1")}>
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "inline-flex items-center transition-colors duration-150",
                  primary
                    ? clsx(
                        "-mb-px h-11 border-b-2 text-sm",
                        active
                          ? "border-accent text-fg"
                          : "border-transparent text-fg-2 hover:text-fg",
                      )
                    : clsx(
                        "h-8 rounded-md px-3 text-[13px]",
                        active
                          ? "bg-accent-soft text-fg"
                          : "text-fg-2 hover:bg-surface-hover hover:text-fg",
                      ),
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
