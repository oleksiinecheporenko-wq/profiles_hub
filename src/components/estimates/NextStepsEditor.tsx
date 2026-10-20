"use client";

import { useState } from "react";
import { ListChecks, Plus, RotateCcw, Trash2 } from "lucide-react";
import { setNextStepsAction } from "@/app/(app)/estimates/actions";
import { Button, IconButton } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_NEXT_STEPS, effectiveNextSteps, type NextStep } from "@/lib/domain/estimate";
import { SaveIndicator } from "./SaveIndicator";
import { useAutosave } from "./useAutosave";

const MAX_STEPS = 6;

const fieldClass =
  "w-full rounded-md border border-transparent bg-transparent px-2 -mx-2 text-fg placeholder:text-fg-muted transition-colors hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none";

type Props = { estimateId: string; steps: NextStep[] | null; editable: boolean };

/** `Next steps` of the client PDF. Without custom steps the standard ones are used. */
export function NextStepsEditor({ estimateId, steps: saved, editable }: Props) {
  const [steps, setSteps] = useState<NextStep[]>(() =>
    (saved ?? DEFAULT_NEXT_STEPS).map((s) => ({ ...s, id: saved ? s.id : crypto.randomUUID() })),
  );
  const [custom, setCustom] = useState(saved !== null);
  const toast = useToast();

  const autosave = useAutosave<NextStep[]>(async (next) => {
    const result = await setNextStepsAction(estimateId, next);
    if (!result.ok) toast.error(result.error);
    return result.ok;
  });

  function update(next: NextStep[]) {
    setSteps(next);
    setCustom(true);
    autosave.schedule(next);
  }

  function reset() {
    setSteps(DEFAULT_NEXT_STEPS.map((s) => ({ ...s, id: crypto.randomUUID() })));
    setCustom(false);
    // An empty list is stored as null: the standard steps.
    autosave.schedule([]);
  }

  const shown = editable ? steps : effectiveNextSteps(saved);

  return (
    <section className="mt-4 rounded-lg border border-line bg-surface-1 p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <ListChecks className="size-4 text-accent" aria-hidden />
            Next steps
          </h2>
          <p className="mt-1 text-[13px] text-fg-muted">
            {custom
              ? "Власні кроки для PDF клієнта."
              : "Стандартні кроки: додаються в PDF автоматично. Змініть їх, якщо потрібно."}
          </p>
        </div>
        {editable && (
          <div className="flex items-center gap-3">
            <SaveIndicator state={autosave.state} />
            {custom && (
              <Button size="sm" icon={<RotateCcw className="size-3.5" aria-hidden />} onClick={reset}>
                Стандартні кроки
              </Button>
            )}
          </div>
        )}
      </div>

      <ol className="grid grid-cols-3 gap-3">
        {shown.map((step, i) => (
          <li key={step.id} className="flex flex-col rounded-md border border-line bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[12px] tracking-widest text-accent">{String(i + 1).padStart(2, "0")}</span>
              {editable && (
                <IconButton
                  label="Видалити крок"
                  size="sm"
                  onClick={() => update(steps.filter((s) => s.id !== step.id))}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </IconButton>
              )}
            </div>
            {editable ? (
              <>
                <input
                  aria-label={`Крок ${i + 1}: назва`}
                  value={step.title}
                  maxLength={80}
                  placeholder="Назва кроку"
                  onChange={(e) => update(steps.map((s) => (s.id === step.id ? { ...s, title: e.target.value } : s)))}
                  className={`${fieldClass} mt-1 h-8 text-[15px] font-semibold`}
                />
                <textarea
                  aria-label={`Крок ${i + 1}: опис`}
                  value={step.text}
                  maxLength={240}
                  rows={2}
                  placeholder="Короткий опис"
                  onChange={(e) => update(steps.map((s) => (s.id === step.id ? { ...s, text: e.target.value } : s)))}
                  className={`${fieldClass} mt-1 resize-none py-1 text-[13px] text-fg-2 [field-sizing:content]`}
                />
              </>
            ) : (
              <>
                <p className="mt-2 text-[15px] font-semibold">{step.title}</p>
                {step.text && <p className="mt-1 text-[13px] text-fg-2">{step.text}</p>}
              </>
            )}
          </li>
        ))}
        {editable && steps.length < MAX_STEPS && (
          <li>
            <button
              type="button"
              onClick={() => update([...steps, { id: crypto.randomUUID(), title: "", text: "" }])}
              className="flex h-full min-h-28 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line-strong text-[13px] text-fg-2 transition-colors hover:border-accent hover:text-fg"
            >
              <Plus className="size-4" aria-hidden />
              Додати крок
            </button>
          </li>
        )}
      </ol>
      {editable && steps.every((s) => !s.title.trim()) && (
        <p className="mt-3 text-[13px] text-fg-muted">Без жодного кроку з назвою в PDF підуть стандартні кроки.</p>
      )}
    </section>
  );
}
