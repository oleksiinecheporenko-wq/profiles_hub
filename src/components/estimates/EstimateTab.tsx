"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { Check, FileDown, Layers, Pencil, Plus, Save, Trash2, UserRound } from "lucide-react";
import {
  archiveAction,
  markReadyAction,
  reopenAction,
  saveRowsAction,
  setRateAction,
  updateInfoAction,
} from "@/app/(app)/estimates/actions";
import { Button, IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { computeTable, costs, newRow, type Estimate, type EstimateRow } from "@/lib/domain/estimate";
import { formatCost, formatHours, formatRate } from "@/lib/format";
import { NextStepsEditor } from "./NextStepsEditor";
import { SaveIndicator } from "./SaveIndicator";
import { useAutosave } from "./useAutosave";

type Props = {
  estimate: Pick<Estimate, "id" | "status" | "developer" | "rows" | "rate" | "nextSteps">;
};

/** Accepts `12`, `12.5`, `12,5`; empty means no estimate yet. Undefined = not a valid number. */
function parseHours(text: string): number | null | undefined {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return undefined;
  return Number(t);
}

const isBlank = (r: EstimateRow) => !r.feature.trim() && !r.notes.trim() && r.realistic === null;

const cellInput =
  "w-full bg-transparent px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted/70 focus:bg-surface-2 focus:outline-none focus-visible:outline-none";

function HoursInput({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const invalid = parseHours(text) === undefined;
  return (
    <input
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={text}
      placeholder="0"
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parseHours(e.target.value);
        if (parsed !== undefined) onChange(parsed);
      }}
      onBlur={() => {
        if (invalid) setText(value === null ? "" : String(value));
      }}
      className={clsx(
        cellInput,
        "text-right font-mono font-semibold",
        invalid && "text-negative",
      )}
    />
  );
}

/** `Оцінка`: developer, the hours table and the ready/archive controls. */
export function EstimateTab({ estimate }: Props) {
  const { id, status } = estimate;
  const editable = status === "in_progress";
  const [rows, setRows] = useState(estimate.rows);
  const [developer, setDeveloper] = useState(estimate.developer ?? "");
  const [savedDeveloper, setSavedDeveloper] = useState(estimate.developer ?? "");
  const [rateText, setRateText] = useState(estimate.rate === null ? "" : String(estimate.rate));
  const [focusId, setFocusId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const autosave = useAutosave<EstimateRow[]>(async (next) => {
    const result = await saveRowsAction(id, next);
    if (!result.ok) toast.error(result.error);
    return result.ok;
  });

  const rate = parseHours(rateText);
  const { lines, total } = computeTable(rows);
  const cost = costs(total, typeof rate === "number" ? rate : null);

  function update(next: EstimateRow[]) {
    setRows(next);
    autosave.schedule(next);
  }
  const patchRow = (rowId: string, patch: Partial<EstimateRow>) =>
    update(rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  const addRow = (kind: EstimateRow["kind"]) => {
    const row = newRow(kind, crypto.randomUUID());
    setFocusId(row.id);
    update([...rows, row]);
  };

  async function saveDeveloper(): Promise<boolean> {
    const value = developer.trim();
    if (value === savedDeveloper) return true;
    const result = await updateInfoAction(id, { developer: value || null });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    setSavedDeveloper(value);
    return true;
  }

  async function saveRate(): Promise<boolean> {
    if (rate === undefined) {
      toast.error("Рейт: вкажіть число, до двох знаків після коми.");
      return false;
    }
    if (rate === estimate.rate) return true;
    const result = await setRateAction(id, rate);
    if (!result.ok) toast.error(result.error);
    return result.ok;
  }

  const markReady = () =>
    startTransition(async () => {
      // Blank placeholder rows are dropped; the report keeps only what was filled in.
      const cleaned = rows.filter((r) => !isBlank(r));
      if (cleaned.length !== rows.length) update(cleaned);
      if (!(await saveDeveloper()) || !(await autosave.flush())) return;
      const result = await markReadyAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Оцінку готово. Запит перенесено в «Готові запити».");
    });

  const reopen = () =>
    startTransition(async () => {
      const result = await reopenAction(id);
      if (!result.ok) toast.error(result.error);
    });

  const archive = () =>
    startTransition(async () => {
      if (typeof rate !== "number") {
        toast.error("Вкажіть рейт у рядку Total перед збереженням.");
        return;
      }
      const result = await archiveAction(id, rate);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Оцінку збережено в архів.");
    });

  const downloadPdf = () =>
    startTransition(async () => {
      if (status === "ready" && !(await saveRate())) return;
      // A file download, not a page: let the browser handle it through a link.
      const link = document.createElement("a");
      link.href = `/api/estimates/${id}/pdf`;
      link.download = "";
      link.click();
    });

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar: developer on the left, the actions on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label htmlFor="developer" className="flex items-center gap-2 text-[15px] font-semibold">
            <UserRound className="size-4 text-accent" aria-hidden />
            Розробник
          </label>
          {editable ? (
            <Input
              id="developer"
              value={developer}
              maxLength={200}
              placeholder="Ім’я розробника"
              onChange={(e) => setDeveloper(e.target.value)}
              onBlur={() => void saveDeveloper()}
              className="w-72"
            />
          ) : (
            <span id="developer" className="text-sm">
              {developer || "—"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {editable && <SaveIndicator state={autosave.state} />}
          {status === "in_progress" && (
            <Button variant="primary" icon={<Check className="size-4" aria-hidden />} loading={pending} onClick={markReady}>
              Готово
            </Button>
          )}
          {status === "ready" && (
            <>
              <Button icon={<Pencil className="size-4" aria-hidden />} disabled={pending} onClick={reopen}>
                Редагувати
              </Button>
              <Button icon={<FileDown className="size-4" aria-hidden />} disabled={pending} onClick={downloadPdf}>
                PDF
              </Button>
              <Button variant="primary" icon={<Save className="size-4" aria-hidden />} loading={pending} onClick={archive}>
                Зберегти
              </Button>
            </>
          )}
          {status === "archived" && (
            <Button icon={<FileDown className="size-4" aria-hidden />} loading={pending} onClick={downloadPdf}>
              PDF
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[30%]" />
            <col />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-32" />
            {editable && <col className="w-12" />}
          </colgroup>
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-[13px] text-fg-2">
              <th scope="col" className="px-3 py-2.5 font-semibold">Feature</th>
              <th scope="col" className="px-3 py-2.5 font-semibold">Notes</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Optimistic (h)</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Pessimistic (h)</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold text-fg">Realistic (h)</th>
              {editable && <th scope="col"><span className="sr-only">Дії</span></th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={editable ? 6 : 5} className="px-3 py-8 text-center text-fg-muted">
                  Рядків немає. Додайте фазу або рядок.
                </td>
              </tr>
            )}
            {lines.map((line) => {
              const row = line.row;
              if ("subtotal" in line) {
                return (
                  <tr key={row.id} className="border-b border-line bg-accent-soft">
                    <td colSpan={2} className="p-0">
                      {editable ? (
                        <input
                          aria-label="Назва фази"
                          value={row.feature}
                          placeholder="Phase"
                          maxLength={500}
                          autoFocus={focusId === row.id}
                          onChange={(e) => patchRow(row.id, { feature: e.target.value })}
                          className={clsx(cellInput, "py-3 text-lg font-bold focus:bg-transparent")}
                        />
                      ) : (
                        <p className="px-3 py-3 text-lg font-bold">{row.feature || "Phase"}</p>
                      )}
                    </td>
                    {(["optimistic", "pessimistic", "realistic"] as const).map((k) => (
                      <td key={k} className="px-3 text-right font-mono text-[13px] font-semibold text-fg-2">
                        {line.subtotal.realistic > 0 ? formatHours(line.subtotal[k]) : ""}
                      </td>
                    ))}
                    {editable && (
                      <td className="text-center">
                        <IconButton label="Видалити фазу" size="sm" onClick={() => update(rows.filter((r) => r.id !== row.id))}>
                          <Trash2 className="size-3.5" aria-hidden />
                        </IconButton>
                      </td>
                    )}
                  </tr>
                );
              }
              return (
                <tr key={row.id} className="border-b border-line align-top last:border-b-0">
                  <td className="border-r border-line p-0">
                    {editable ? (
                      <input
                        aria-label="Feature"
                        value={row.feature}
                        placeholder="Фіча"
                        maxLength={500}
                        autoFocus={focusId === row.id}
                        onChange={(e) => patchRow(row.id, { feature: e.target.value })}
                        className={cellInput}
                      />
                    ) : (
                      <p className="px-3 py-2.5">{row.feature}</p>
                    )}
                  </td>
                  <td className="border-r border-line p-0">
                    {editable ? (
                      <textarea
                        aria-label="Notes"
                        value={row.notes}
                        rows={1}
                        maxLength={5000}
                        onChange={(e) => patchRow(row.id, { notes: e.target.value })}
                        className={clsx(cellInput, "block resize-none [field-sizing:content]")}
                      />
                    ) : (
                      <p className="px-3 py-2.5 whitespace-pre-wrap text-fg-2">{row.notes}</p>
                    )}
                  </td>
                  <td className="border-r border-line px-3 py-2.5 text-right font-mono text-fg-2">
                    {row.realistic === null ? "" : formatHours(line.optimistic)}
                  </td>
                  <td className="border-r border-line px-3 py-2.5 text-right font-mono text-fg-2">
                    {row.realistic === null ? "" : formatHours(line.pessimistic)}
                  </td>
                  <td className={clsx("p-0", editable && "border-r border-line")}>
                    {editable ? (
                      <HoursInput
                        label={`Realistic, год${row.feature ? `: ${row.feature}` : ""}`}
                        value={row.realistic}
                        onChange={(v) => patchRow(row.id, { realistic: v })}
                      />
                    ) : (
                      <p className="px-3 py-2.5 text-right font-mono font-semibold">{formatHours(row.realistic)}</p>
                    )}
                  </td>
                  {editable && (
                    <td className="pt-1.5 text-center">
                      <IconButton label="Видалити рядок" size="sm" onClick={() => update(rows.filter((r) => r.id !== row.id))}>
                        <Trash2 className="size-3.5" aria-hidden />
                      </IconButton>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {!editable && (
            <tfoot>
              <tr className="border-t-2 border-positive/50 bg-positive-soft align-top text-positive">
                <th scope="row" className="px-3 py-3 text-left text-lg font-bold">
                  Total
                </th>
                <td className="px-3 py-3">
                  {status === "ready" ? (
                    <label className="flex items-center gap-2 text-sm text-fg">
                      <span className="font-semibold text-positive">Рейт</span>
                      <span className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted">$</span>
                        <input
                          inputMode="decimal"
                          value={rateText}
                          placeholder="0"
                          aria-label="Рейт, $ за годину"
                          aria-invalid={rate === undefined || undefined}
                          onChange={(e) => setRateText(e.target.value)}
                          onBlur={() => void saveRate()}
                          className="h-9 w-28 rounded-md border border-positive/40 bg-surface-1 pr-2 pl-6 text-right font-mono text-fg focus:border-positive focus:ring-2 focus:ring-positive/25 focus:outline-none aria-[invalid=true]:border-negative"
                        />
                      </span>
                      <span className="text-fg-muted">/год</span>
                    </label>
                  ) : (
                    <p className="text-sm">
                      <span className="font-semibold">Рейт</span>{" "}
                      <span className="font-mono text-fg">{formatRate(estimate.rate)}</span>
                    </p>
                  )}
                </td>
                {(["optimistic", "pessimistic", "realistic"] as const).map((k) => (
                  <td key={k} className="px-3 py-3 text-right font-mono">
                    <p className="text-base font-bold">{formatHours(total[k])} h</p>
                    <p className="mt-1 text-[13px] font-semibold text-fg" title="Рейт × години">
                      {cost ? formatCost(cost[k]) : "—"}
                    </p>
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editable && (
        <div className="flex gap-2">
          <Button icon={<Layers className="size-4" aria-hidden />} onClick={() => addRow("phase")}>
            Add Phase
          </Button>
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => addRow("task")}>
            Add a Row
          </Button>
        </div>
      )}

      {!editable && <NextStepsEditor estimateId={id} steps={estimate.nextSteps} editable={status === "ready"} />}
    </div>
  );
}
