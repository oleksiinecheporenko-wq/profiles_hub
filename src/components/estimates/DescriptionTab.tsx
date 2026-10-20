"use client";

import { useState } from "react";
import { FileText, Info, Paperclip, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { updateInfoAction } from "@/app/(app)/estimates/actions";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import type { Estimate, EstimateFile } from "@/lib/domain/estimate";
import { Materials } from "./Materials";
import { SaveIndicator } from "./SaveIndicator";
import type { SaveState } from "./useAutosave";

type TextField = "jobTitle" | "jobDescription" | "additionalInfo";

type Props = {
  estimate: Pick<Estimate, "id" | "status" | "jobTitle" | "jobDescription" | "additionalInfo" | "links">;
  files: (EstimateFile & { url: string | null })[];
};

function SectionTitle({ icon: Icon, children, htmlFor }: { icon: LucideIcon; children: string; htmlFor?: string }) {
  const Tag = htmlFor ? "label" : "h2";
  return (
    <Tag htmlFor={htmlFor} className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
      <Icon className="size-4 text-accent" aria-hidden />
      {children}
    </Tag>
  );
}

/** `Опис`: the job post and everything the client sent. Saved on blur. */
export function DescriptionTab({ estimate, files }: Props) {
  const editable = estimate.status !== "archived";
  const [values, setValues] = useState<Record<TextField, string>>({
    jobTitle: estimate.jobTitle ?? "",
    jobDescription: estimate.jobDescription ?? "",
    additionalInfo: estimate.additionalInfo ?? "",
  });
  const [saved, setSaved] = useState(values);
  const [state, setState] = useState<SaveState>("idle");
  const toast = useToast();

  async function save(field: TextField) {
    const value = values[field].trim();
    if (value === saved[field].trim()) return;
    setState("saving");
    const result = await updateInfoAction(estimate.id, { [field]: value || null });
    if (!result.ok) {
      setState("error");
      toast.error(result.error);
      return;
    }
    setSaved((s) => ({ ...s, [field]: value }));
    setState("saved");
  }

  const bind = (field: TextField) => ({
    id: `field-${field}`,
    value: values[field],
    readOnly: !editable,
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: e.target.value })),
    onBlur: () => save(field),
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex h-5 justify-end">
        <SaveIndicator state={state} />
      </div>
      <section className="-mt-8">
        <SectionTitle icon={Type} htmlFor="field-jobTitle">
          Заголовок джоб посту
        </SectionTitle>
        <Input {...bind("jobTitle")} maxLength={500} placeholder="Наприклад: Need a developer for an online store" />
      </section>

      <section>
        <SectionTitle icon={FileText} htmlFor="field-jobDescription">
          Опис джоб посту
        </SectionTitle>
        <Textarea
          {...bind("jobDescription")}
          maxLength={50000}
          placeholder="Вставте текст джоб посту"
          className="min-h-48 [field-sizing:content]"
        />
      </section>

      <section>
        <SectionTitle icon={Info} htmlFor="field-additionalInfo">
          Додаткова інформація
        </SectionTitle>
        <Textarea
          {...bind("additionalInfo")}
          maxLength={50000}
          placeholder="Відповіді клієнта, дедлайни, бюджет, нюанси"
          className="min-h-28 [field-sizing:content]"
        />
      </section>

      <section>
        <SectionTitle icon={Paperclip}>Матеріали</SectionTitle>
        <Materials estimateId={estimate.id} editable={editable} initialFiles={files} initialLinks={estimate.links} />
      </section>
    </div>
  );
}
