import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

const variants: Record<Variant, string> = {
  primary: "bg-accent text-[#1a0d08] hover:bg-accent-hover font-medium",
  secondary:
    "bg-surface-2 text-fg border border-line-strong hover:bg-surface-hover",
  ghost: "text-fg-2 hover:text-fg hover:bg-surface-hover",
  danger:
    "bg-negative-soft text-negative border border-negative/30 hover:bg-negative/20",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
};

export const buttonClassName = (variant: Variant = "secondary", size: Size = "md") =>
  clsx(
    "inline-flex shrink-0 items-center justify-center rounded-md whitespace-nowrap select-none",
    "transition-colors duration-150 cursor-pointer",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(buttonClassName(variant, size), className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: Size;
};

/** Square icon-only button; `label` becomes the accessible name and tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-md text-fg-muted cursor-pointer",
        "transition-colors duration-150 hover:bg-surface-hover hover:text-fg",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "size-7" : "size-9",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
