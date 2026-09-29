import type { ReactNode } from "react";
import clsx from "clsx";
import {
  AlignLeft,
  Award,
  Briefcase,
  CalendarDays,
  DollarSign,
  History,
  Images,
  Info,
  MessageCircle,
  MessagesSquare,
  Package,
  Sparkles,
  Tags,
  Type,
  type LucideIcon,
} from "lucide-react";

/** Icons for version fields and other labelled blocks. */
export const FIELD_ICONS = {
  update_date: CalendarDays,
  title: Type,
  rate: DollarSign,
  description: AlignLeft,
  portfolio: Images,
  skills: Tags,
  project_catalog: Package,
  certifications: Award,
  employment_history: Briefcase,
  other_experiences: Sparkles,
  additional_info: Info,
  history: History,
  dialog: MessagesSquare,
  comments: MessageCircle,
} satisfies Record<string, LucideIcon>;

export type FieldIconKey = keyof typeof FIELD_ICONS;

/** Bold label with a thematic icon; replaces the old `01 / LABEL` captions. */
export function FieldLabel({
  icon,
  children,
  as: Tag = "span",
  htmlFor,
  className,
}: {
  icon: FieldIconKey | LucideIcon;
  children: ReactNode;
  as?: "span" | "h2" | "h3" | "label";
  htmlFor?: string;
  className?: string;
}) {
  const Icon = typeof icon === "string" ? FIELD_ICONS[icon] : icon;
  return (
    <Tag
      {...(Tag === "label" && htmlFor ? { htmlFor } : {})}
      className={clsx("flex items-center gap-2 text-[13px] font-semibold text-fg", className)}
    >
      <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden />
      <span>{children}</span>
    </Tag>
  );
}

/** Section heading: bold, with an icon (e.g. `Вміст профілю`, `Історія змін`). */
export function SectionHeading({
  icon: Icon,
  children,
  id,
  as: Tag = "h2",
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  id?: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <Tag id={id} className={clsx("flex items-center gap-2 text-sm font-semibold text-fg", className)}>
      <Icon className="size-4 shrink-0 text-accent" aria-hidden />
      {children}
    </Tag>
  );
}
