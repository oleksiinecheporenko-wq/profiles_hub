import { z } from "zod";

const blankToNull = (v: unknown) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v);

const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().max(max, { message: `Не більше ${max} символів.` }).nullable());

const requiredText = (max: number, message: string) =>
  z.string({ message }).trim().min(1, { message }).max(max, { message: `Не більше ${max} символів.` });

export const uuid = z.uuid({ message: "Некоректний ідентифікатор." });

export const urlSchema = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
  message: "Вкажіть коректне посилання (http або https).",
});

/** Hours: non-negative, up to two decimals. */
export const hoursSchema = z
  .number({ message: "Вкажіть число." })
  .finite({ message: "Вкажіть число." })
  .min(0, { message: "Години не можуть бути від’ємними." })
  .max(10000, { message: "Забагато годин." })
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, { message: "Не більше двох знаків після коми." });

export const rateSchema = z
  .number({ message: "Вкажіть рейт." })
  .finite({ message: "Вкажіть рейт." })
  .min(0, { message: "Рейт не може бути від’ємним." })
  .max(100000, { message: "Завеликий рейт." })
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, { message: "Не більше двох знаків після коми." });

export const createEstimateSchema = z.object({
  clientName: requiredText(200, "Вкажіть ім’я клієнта."),
  projectName: optionalText(300),
});

export const linkSchema = z.object({
  id: uuid,
  url: urlSchema,
  label: optionalText(200),
});

/** Text fields of the card and `Опис`; each key optional. */
export const estimateInfoPatchSchema = z
  .object({
    clientName: requiredText(200, "Вкажіть ім’я клієнта."),
    projectName: optionalText(300),
    jobTitle: optionalText(500),
    jobDescription: optionalText(50000),
    additionalInfo: optionalText(50000),
    developer: optionalText(200),
    links: z.array(linkSchema).max(100),
  })
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, { message: "Немає змін для збереження." });

export const rowSchema = z
  .object({
    id: uuid,
    kind: z.enum(["phase", "task"]),
    feature: z.string().max(500, { message: "Feature: не більше 500 символів." }),
    notes: z.string().max(5000, { message: "Notes: не більше 5000 символів." }),
    realistic: hoursSchema.nullable(),
  })
  // A phase is a heading: it never carries hours.
  .transform((r) => (r.kind === "phase" ? { ...r, realistic: null } : r));

export const rowsSchema = z
  .array(rowSchema)
  .max(500, { message: "Забагато рядків." })
  .refine((rows) => new Set(rows.map((r) => r.id)).size === rows.length, { message: "Рядки мають повторювані id." });

export const nextStepsSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      title: z.string().trim().max(80, { message: "Назва кроку: не більше 80 символів." }),
      text: z.string().trim().max(240, { message: "Опис кроку: не більше 240 символів." }),
    }),
  )
  .max(6, { message: "Не більше 6 кроків." })
  // Steps without a title are dropped; an empty list means the standard steps.
  .transform((steps) => {
    const kept = steps.filter((s) => s.title !== "");
    return kept.length > 0 ? kept : null;
  });

export const fileMetaSchema = z.object({
  path: z.string().min(1).max(500),
  name: requiredText(300, "Немає назви файлу."),
  mimeType: z.string().max(200).nullable(),
  size: z.number().int().min(0).max(52428800, { message: "Файл більший за 50 МБ." }),
});

export type CreateEstimateInput = z.output<typeof createEstimateSchema>;
export type EstimateInfoPatch = z.output<typeof estimateInfoPatchSchema>;
export type FileMeta = z.output<typeof fileMetaSchema>;

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Дані не пройшли перевірку.";
}
