"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { controlClassName } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { LANGUAGE_LEVELS, LANGUAGE_LEVEL_LABELS, type LanguageLevel } from "@/lib/domain/enums";
import type { ProfileLanguage } from "@/lib/domain/types";
import { LANGUAGES } from "@/lib/reference/languages";
import { languagesSchema } from "@/lib/validation/profile";

type Row = { key: string; language: string | null; level: LanguageLevel };

const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ value: l, label: l }));

let rowCounter = 0;
const newKey = () => `row-${++rowCounter}`;

/** Editable list of language + level rows, saved as a whole. */
export function LanguagesField({
  languages,
  onSave,
}: {
  languages: ProfileLanguage[];
  onSave: (rows: { language: string; level: LanguageLevel }[]) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setRows(languages.map((l) => ({ key: newKey(), language: l.language, level: l.level })));
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    if (saving) return;
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    const filled = rows.filter((r) => r.language);
    const parsed = languagesSchema.safeParse(filled.map((r) => ({ language: r.language, level: r.level })));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Перевірте мови.");
      return;
    }
    setSaving(true);
    const serverError = await onSave(parsed.data);
    setSaving(false);
    if (serverError) {
      setError(serverError);
      return;
    }
    setEditing(false);
  };

  const update = (key: string, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div
      className="group grid grid-cols-[var(--label-w,152px)_minmax(0,1fr)] gap-x-4 border-b border-line py-3 last:border-b-0"
      onKeyDown={(e) => {
        if (editing && e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
    >
      <span className="pt-[3px] text-[13px] text-fg-muted">Languages</span>

      {!editing ? (
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1 pt-[2px] text-sm">
            {languages.length === 0 ? (
              <span className="text-fg-muted">—</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {languages.map((l) => (
                  <li key={l.id} className="flex items-baseline gap-2">
                    <span className="text-fg">{l.language}</span>
                    <span className="text-[13px] text-fg-muted">{LANGUAGE_LEVEL_LABELS[l.level]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={start}
            aria-label="Редагувати: Languages"
            title="Редагувати"
            className="-mt-0.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted opacity-40 transition duration-150 group-hover:opacity-100 hover:bg-surface-hover hover:text-fg focus-visible:opacity-100"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-2">
          {rows.map((row, i) => {
            const taken = new Set(rows.filter((r) => r.key !== row.key).map((r) => r.language));
            return (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_11rem_auto] items-center gap-2">
                <SearchableSelect
                  aria-label={`Мова ${i + 1}`}
                  value={row.language}
                  onChange={(v) => update(row.key, { language: v })}
                  options={LANGUAGE_OPTIONS.filter((o) => !taken.has(o.value))}
                  placeholder="Мова"
                  clearable={false}
                  autoFocus={i === rows.length - 1 && row.language === null}
                />
                <select
                  aria-label={`Рівень ${i + 1}`}
                  value={row.level}
                  onChange={(e) => update(row.key, { level: e.target.value as LanguageLevel })}
                  className={clsx(controlClassName, "h-10 cursor-pointer")}
                >
                  {LANGUAGE_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {LANGUAGE_LEVEL_LABELS[lvl]}
                    </option>
                  ))}
                </select>
                <IconButton
                  label={`Видалити мову ${row.language ?? i + 1}`}
                  onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus className="size-3.5" aria-hidden />}
              onClick={() => setRows((list) => [...list, { key: newKey(), language: null, level: "conversational" }])}
            >
              Додати мову
            </Button>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={cancel} disabled={saving} icon={<X className="size-3.5" aria-hidden />}>
                Скасувати
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => void save()}
                disabled={saving}
                icon={saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
              >
                Зберегти
              </Button>
            </div>
          </div>
          {error && (
            <p className="text-xs text-negative" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
