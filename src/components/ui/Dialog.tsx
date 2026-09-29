"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { Button, IconButton } from "./Button";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Small `//` metadata above the title. */
  meta?: string;
  width?: number;
  footer?: ReactNode;
  children: ReactNode;
  /** Blocks Escape/backdrop closing, e.g. while a request is in flight. */
  dismissible?: boolean;
};

/** Modal on top of the native <dialog>: focus trap, Escape and top layer come for free. */
export function Dialog({
  open,
  onClose,
  title,
  meta,
  width = 540,
  footer,
  children,
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // showModal() focuses the first focusable element (the close button);
      // move focus to the field marked with data-autofocus instead.
      el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onMouseDown={(e) => {
        // Click on the backdrop: the event target is the dialog element itself.
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
      style={{ width }}
      className={clsx(
        "m-auto max-h-[calc(100vh-64px)] max-w-[calc(100vw-64px)] overflow-hidden rounded-lg p-0",
        "border border-line-strong bg-surface-1 text-fg shadow-[0_24px_64px_rgba(0,0,0,.5)]",
        "open:flex open:animate-dialog-in open:flex-col",
      )}
    >
      {open && (
        <>
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-5 pb-4">
            <div>
              {meta && <p className="font-mono text-xs text-fg-muted">{`// ${meta}`}</p>}
              <h2 id={titleId} className="mt-1 text-lg font-semibold">
                {title}
              </h2>
            </div>
            <IconButton label="Закрити" size="sm" onClick={onClose} disabled={!dismissible}>
              <X className="size-4" aria-hidden />
            </IconButton>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>
          )}
        </>
      )}
    </dialog>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content, e.g. the optional `Причина` field of a status change. */
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Підтвердити",
  cancelLabel = "Скасувати",
  tone = "default",
  loading,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      width={460}
      dismissible={!loading}
      footer={
        <>
          <Button onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {message && <div className="text-sm text-fg-2">{message}</div>}
        {children}
      </div>
    </Dialog>
  );
}
