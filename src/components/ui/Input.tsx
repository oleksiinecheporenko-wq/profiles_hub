import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import clsx from "clsx";

export const controlClassName = clsx(
  "w-full rounded-md border border-line-strong bg-surface-1 px-3 text-sm text-fg",
  "placeholder:text-fg-muted transition-colors duration-150",
  "hover:border-white/20 focus:border-accent focus:outline-none focus-visible:outline-none",
  "focus:ring-2 focus:ring-accent/25",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "aria-[invalid=true]:border-negative aria-[invalid=true]:focus:ring-negative/25",
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={clsx(controlClassName, "h-10", className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={clsx(controlClassName, "min-h-24 resize-y py-2 leading-relaxed", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={clsx(controlClassName, "h-10 cursor-pointer pr-8", className)}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

type FieldProps = {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
};

/** Label + control + error/hint, with the ids wired for accessibility. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] text-fg-2">
        {label}
        {required && <span className="ml-0.5 text-accent" aria-hidden>*</span>}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? messageId : undefined,
      })}
      {error ? (
        <p id={messageId} className="text-[13px] text-negative">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-[13px] text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
