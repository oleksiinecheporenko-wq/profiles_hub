"use client";

import { useState } from "react";
import clsx from "clsx";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { SortableList } from "@/components/ui/SortableList";
import { COLLECTION_META, itemMetaLine } from "@/lib/domain/collections";
import type { DailyChangeInput } from "@/lib/domain/dailyChanges";
import type { CollectionField, CollectionItem } from "@/lib/domain/types";
import { collectionItemSchemas } from "@/lib/validation/version";
import { ItemFieldControl } from "./CollectionEditor";

/** Applies one change; resolves to an error message or null. */
export type ApplyChange = (change: DailyChangeInput) => Promise<string | null>;

type Props = {
  field: CollectionField;
  items: CollectionItem[];
  apply: ApplyChange;
  imageUrls: Record<string, string>;
  onImageUploaded: (path: string, url: string | null) => void;
  disabled?: boolean;
};

function validate(field: CollectionField, item: CollectionItem) {
  const parsed = collectionItemSchemas[field].safeParse(item);
  if (parsed.success) return { item: parsed.data as CollectionItem, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "_")] ??= issue.message;
  return { item: null, errors };
}

/** Item editor: a local draft, saved as one `add` or `update` daily change. */
function ItemDraft({
  field,
  initial,
  isNew,
  apply,
  onDone,
  imageUrls,
  onImageUploaded,
}: {
  field: CollectionField;
  initial: CollectionItem;
  isNew: boolean;
  apply: ApplyChange;
  onDone: () => void;
  imageUrls: Record<string, string>;
  onImageUploaded: (path: string, url: string | null) => void;
}) {
  const meta = COLLECTION_META[field];
  const [draft, setDraft] = useState<CollectionItem>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const { item, errors: found } = validate(field, draft);
    if (!item) return setErrors(found);
    setErrors({});
    setSaving(true);
    const error = await apply(isNew ? { field, op: "add", item } : { field, op: "update", item });
    setSaving(false);
    if (!error) onDone();
  };

  return (
    <div
      className="border-t border-line px-3 pt-3 pb-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (!saving) onDone();
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {meta.fields.map((f, i) => (
          <ItemFieldControl
            key={f.key}
            meta={f}
            item={draft}
            error={errors[f.key]}
            onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }) as CollectionItem)}
            imageUrls={imageUrls}
            onImageUploaded={onImageUploaded}
            autoFocus={i === 0}
          />
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" onClick={onDone} disabled={saving}>
          Скасувати
        </Button>
        <Button size="sm" variant="primary" onClick={() => void save()} loading={saving}>
          {isNew ? "Додати" : "Зберегти"}
        </Button>
      </div>
    </div>
  );
}

/** Collection edited item by item: every add, edit, delete and reorder is a daily change. */
export function DailyCollection({ field, items, apply, imageUrls, onImageUploaded, disabled }: Props) {
  const meta = COLLECTION_META[field];
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<CollectionItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CollectionItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  // Optimistic order while a reorder request is in flight.
  const [pendingOrder, setPendingOrder] = useState<CollectionItem[] | null>(null);
  const shown = pendingOrder ?? items;

  const reorder = async (next: CollectionItem[]) => {
    setPendingOrder(next);
    setReordering(true);
    await apply({ field, op: "reorder", ids: next.map((i) => i.id) });
    setReordering(false);
    setPendingOrder(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {shown.length > 0 && (
        <SortableList
          items={shown}
          onReorder={(next) => void reorder(next)}
          itemLabel={(i) => meta.summary(i)}
          disabled={disabled || reordering || editing !== null}
          renderItem={(item, { handle, isDragging }) => {
            const line = itemMetaLine(field, item);
            const open = editing === item.id;
            return (
              <div className={clsx("rounded-md border border-line bg-surface-1", isDragging && "shadow-[0_8px_24px_rgba(0,0,0,.45)]")}>
                <div className="flex items-center gap-2 py-2 pr-2 pl-1">
                  {handle}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{meta.summary(item)}</p>
                    {line && <p className="truncate font-mono text-xs text-fg-muted">{line}</p>}
                  </div>
                  {!open && (
                    <>
                      <IconButton
                        label={`Редагувати: ${meta.summary(item)}`}
                        size="sm"
                        disabled={disabled}
                        onClick={() => {
                          setAdding(null);
                          setEditing(item.id);
                        }}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </IconButton>
                      <IconButton label={`Видалити: ${meta.summary(item)}`} size="sm" disabled={disabled} onClick={() => setConfirmDelete(item)}>
                        <Trash2 className="size-3.5" aria-hidden />
                      </IconButton>
                    </>
                  )}
                </div>
                {open && (
                  <ItemDraft
                    field={field}
                    initial={item}
                    isNew={false}
                    apply={apply}
                    onDone={() => setEditing(null)}
                    imageUrls={imageUrls}
                    onImageUploaded={onImageUploaded}
                  />
                )}
              </div>
            );
          }}
        />
      )}
      {reordering && (
        <p className="flex items-center gap-1.5 text-xs text-fg-muted" role="status">
          <Loader2 className="size-3 animate-spin" aria-hidden /> Зберігаємо порядок…
        </p>
      )}

      {adding ? (
        <div className="rounded-md border border-accent/40 bg-surface-1">
          <p className="px-3 pt-2 text-[13px] text-fg-2">Новий елемент</p>
          <ItemDraft
            field={field}
            initial={adding}
            isNew
            apply={apply}
            onDone={() => setAdding(null)}
            imageUrls={imageUrls}
            onImageUploaded={onImageUploaded}
          />
        </div>
      ) : (
        <div>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              setEditing(null);
              setAdding(meta.newItem(crypto.randomUUID()));
            }}
            icon={<Plus className="size-3.5" aria-hidden />}
          >
            Додати {meta.itemNoun}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Видалити з ${meta.label}?`}
        message={confirmDelete ? <>«{meta.summary(confirmDelete)}» буде видалено з Актуальної версії. Зміну буде записано в історію.</> : null}
        confirmLabel="Видалити"
        tone="danger"
        loading={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          setDeleting(true);
          const error = await apply({ field, op: "remove", itemId: confirmDelete.id });
          setDeleting(false);
          if (!error) setConfirmDelete(null);
        }}
      />
    </div>
  );
}
