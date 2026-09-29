"use client";

import { useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { Check, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { uploadPortfolioImageAction } from "@/app/(app)/profiles/[id]/versionActions";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { controlClassName } from "@/components/ui/Input";
import { SortableList } from "@/components/ui/SortableList";
import { useToast } from "@/components/ui/Toast";
import { COLLECTION_META, type ItemFieldMeta } from "@/lib/domain/collections";
import type { CollectionField, CollectionItem } from "@/lib/domain/types";
import { formatPlainDate, formatPrice } from "@/lib/format";
import { IMAGE_ACCEPT, precheckImage } from "@/lib/upload";

type Props = {
  field: CollectionField;
  items: CollectionItem[];
  onChange: (items: CollectionItem[]) => void;
  /** Errors keyed `${itemId}.${key}`. */
  errors: Record<string, string>;
  imageUrls: Record<string, string>;
  onImageUploaded: (path: string, url: string | null) => void;
};

/** Money input keeping the raw text while typing (`12.` is not a number yet). */
function MoneyInput({
  value,
  onChange,
  ...rest
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== (text.trim() === "" ? null : Number(text.replace(",", ".")))) setText(value === null ? "" : String(value));
  }
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm text-fg-muted">$</span>
      <input
        {...rest}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const raw = e.target.value.trim().replace(",", ".");
          const n = raw === "" ? null : Number(raw);
          onChange(n === null || Number.isFinite(n) ? n : NaN);
        }}
        className={clsx(controlClassName, "h-10 pl-7 font-mono")}
      />
    </div>
  );
}

function ImageField({
  path,
  url,
  onChange,
  onUploaded,
}: {
  path: string | null;
  url: string | undefined;
  onChange: (path: string | null) => void;
  onUploaded: (path: string, url: string | null) => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  const upload = (file: File | undefined) => {
    if (!file) return;
    const problem = precheckImage(file);
    if (problem) return toast.error(problem);
    const form = new FormData();
    form.set("image", file);
    start(async () => {
      const result = await uploadPortfolioImageAction(form);
      if (!result.ok) return toast.error(result.error);
      onUploaded(result.data.path, result.data.url);
      onChange(result.data.path);
    });
  };

  return (
    <div className="flex items-center gap-3">
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line-strong bg-surface-2 text-fg-muted">
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-5" aria-hidden />
        )}
      </span>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => input.current?.click()} disabled={pending}>
          {path ? "Замінити" : "Завантажити"}
        </Button>
        {path && (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)} disabled={pending} icon={<X className="size-3.5" aria-hidden />}>
            Прибрати
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Зображення"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ItemFieldControl({
  meta,
  item,
  error,
  onChange,
  imageUrls,
  onImageUploaded,
  autoFocus,
}: {
  meta: ItemFieldMeta;
  item: CollectionItem;
  error?: string;
  onChange: (value: unknown) => void;
  imageUrls: Record<string, string>;
  onImageUploaded: (path: string, url: string | null) => void;
  autoFocus?: boolean;
}) {
  const id = `${item.id}-${meta.key}`;
  const value = (item as Record<string, unknown>)[meta.key];
  const aria = { id, "aria-invalid": error ? (true as const) : undefined, "aria-describedby": error ? `${id}-err` : undefined };
  const str = typeof value === "string" ? value : "";

  let control;
  switch (meta.kind) {
    case "textarea":
      control = (
        <textarea
          {...aria}
          rows={3}
          value={str}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className={clsx(controlClassName, "resize-y py-2 leading-relaxed")}
        />
      );
      break;
    case "money":
      control = <MoneyInput {...aria} value={typeof value === "number" ? value : null} onChange={onChange} />;
      break;
    case "date":
      control = (
        <input
          {...aria}
          type="date"
          value={str}
          onChange={(e) => onChange(e.target.value || null)}
          className={clsx(controlClassName, "h-10 font-mono [color-scheme:dark]")}
        />
      );
      break;
    case "image":
      control = (
        <ImageField
          path={typeof value === "string" ? value : null}
          url={typeof value === "string" ? imageUrls[value] : undefined}
          onChange={onChange}
          onUploaded={onImageUploaded}
        />
      );
      break;
    default:
      control = (
        <input
          {...aria}
          type={meta.kind === "url" ? "url" : "text"}
          inputMode={meta.kind === "url" ? "url" : undefined}
          placeholder={meta.kind === "url" ? "https://…" : undefined}
          autoFocus={autoFocus}
          value={str}
          onChange={(e) =>
            onChange(meta.required ? e.target.value : e.target.value === "" ? null : e.target.value)
          }
          className={clsx(controlClassName, "h-10")}
        />
      );
  }

  return (
    <div className={clsx("flex flex-col gap-1.5", (meta.kind === "textarea" || meta.kind === "image") && "col-span-2")}>
      <label htmlFor={meta.kind === "image" ? undefined : id} className="text-[13px] text-fg-2">
        {meta.label}
        {meta.required && <span className="ml-0.5 text-accent" aria-hidden>*</span>}
      </label>
      {control}
      {error && (
        <p id={`${id}-err`} className="text-[13px] text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

function itemMetaLine(field: CollectionField, item: CollectionItem): string | null {
  const i = item as Record<string, unknown>;
  switch (field) {
    case "project_catalog":
      return typeof i.price === "number" ? formatPrice(i.price) : null;
    case "certifications":
      return [i.issuer, typeof i.date === "string" ? formatPlainDate(i.date) : null].filter(Boolean).join(" · ") || null;
    case "employment_history": {
      const from = typeof i.date_from === "string" ? formatPlainDate(i.date_from) : "—";
      const to = typeof i.date_to === "string" ? formatPlainDate(i.date_to) : "по теперішній час";
      return `${from} — ${to}`;
    }
    default:
      return typeof i.url === "string" ? i.url : null;
  }
}

/** Compact, reorderable list of collection items with inline add/edit/delete. */
export function CollectionEditor({ field, items, onChange, errors, imageUrls, onImageUploaded }: Props) {
  const meta = COLLECTION_META[field];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CollectionItem | null>(null);

  const hasError = (id: string) => Object.keys(errors).some((k) => k.startsWith(`${id}.`));
  const toggle = (id: string, open: boolean) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  const update = (id: string, key: string, value: unknown) =>
    onChange(items.map((i) => (i.id === id ? ({ ...i, [key]: value } as CollectionItem) : i)));

  const add = () => {
    const item = meta.newItem(crypto.randomUUID());
    onChange([...items, item]);
    toggle(item.id, true);
    setJustAdded(item.id);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <SortableList
          items={items}
          onReorder={onChange}
          itemLabel={(i) => meta.summary(i)}
          renderItem={(item, { handle, isDragging }) => {
            const open = expanded.has(item.id) || hasError(item.id);
            const line = itemMetaLine(field, item);
            return (
              <div
                className={clsx(
                  "rounded-md border bg-surface-1 transition-shadow",
                  hasError(item.id) ? "border-negative/50" : "border-line",
                  isDragging && "shadow-[0_8px_24px_rgba(0,0,0,.45)]",
                )}
              >
                <div className="flex items-center gap-2 py-2 pr-2 pl-1">
                  {handle}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{meta.summary(item)}</p>
                    {line && <p className="truncate font-mono text-xs text-fg-muted">{line}</p>}
                  </div>
                  {open ? (
                    <Button size="sm" variant="ghost" onClick={() => toggle(item.id, false)} icon={<Check className="size-3.5" aria-hidden />}>
                      Готово
                    </Button>
                  ) : (
                    <IconButton label={`Редагувати: ${meta.summary(item)}`} size="sm" onClick={() => toggle(item.id, true)}>
                      <Pencil className="size-3.5" aria-hidden />
                    </IconButton>
                  )}
                  <IconButton label={`Видалити: ${meta.summary(item)}`} size="sm" onClick={() => setConfirmDelete(item)}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </IconButton>
                </div>
                {open && (
                  <div className="grid grid-cols-2 gap-3 border-t border-line px-3 pt-3 pb-3">
                    {meta.fields.map((f, idx) => (
                      <ItemFieldControl
                        key={f.key}
                        meta={f}
                        item={item}
                        error={errors[`${item.id}.${f.key}`]}
                        onChange={(v) => update(item.id, f.key, v)}
                        imageUrls={imageUrls}
                        onImageUploaded={onImageUploaded}
                        autoFocus={idx === 0 && justAdded === item.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        />
      )}
      <div>
        <Button size="sm" variant="ghost" onClick={add} icon={<Plus className="size-3.5" aria-hidden />}>
          Додати {meta.itemNoun}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Видалити з ${meta.label}?`}
        message={confirmDelete ? <>«{meta.summary(confirmDelete)}» буде прибрано з форми. Зміни збережуться після натискання «Зберегти».</> : null}
        confirmLabel="Видалити"
        tone="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) onChange(items.filter((i) => i.id !== confirmDelete.id));
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
