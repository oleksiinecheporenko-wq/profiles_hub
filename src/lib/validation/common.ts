import { z } from "zod";

export const MAX_SKILLS = 20;
export const MAX_DESCRIPTION = 5000;
export const MAX_SHORT_TEXT = 300;
export const MAX_LONG_TEXT = 20000;
export const MAX_DIALOG = 200000;

const blankToNull = (value: unknown) =>
  value === undefined || (typeof value === "string" && value.trim() === "") ? null : value;

export const uuid = z.uuid({ message: "Некоректний ідентифікатор." });

export const requiredText = (max = MAX_SHORT_TEXT, message = "Поле обов’язкове.") =>
  z
    .string({ message })
    .trim()
    .min(1, { message })
    .max(max, { message: `Не більше ${max} символів.` });

export const optionalText = (max = MAX_LONG_TEXT) =>
  z.preprocess(
    blankToNull,
    z.string().trim().max(max, { message: `Не більше ${max} символів.` }).nullable(),
  );

/** http/https only, with a real domain name. */
export const urlSchema = z.url({
  protocol: /^https?$/,
  hostname: z.regexes.domain,
  message: "Вкажіть коректне посилання (http або https).",
});

export const optionalUrl = z.preprocess(blankToNull, urlSchema.nullable());

export const optionalEmail = z.preprocess(
  blankToNull,
  z.email({ message: "Вкажіть коректний email." }).nullable(),
);

export const plainDate = z.iso.date({ message: "Вкажіть коректну дату." });
export const optionalPlainDate = z.preprocess(blankToNull, plainDate.nullable());

/** Money: non-negative, at most two decimals, fits numeric(10,2). */
export const money = z
  .number({ message: "Вкажіть число." })
  .finite({ message: "Вкажіть число." })
  .min(0, { message: "Значення не може бути від’ємним." })
  .max(99_999_999.99, { message: "Завелике значення." })
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: "Не більше двох знаків після коми.",
  });

export const optionalMoney = z.preprocess(
  (v) => (v === undefined || v === "" ? null : v),
  money.nullable(),
);

/** Tag normalization for duplicate checks: trimmed, single spaces, case-insensitive. */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ").toLocaleLowerCase("uk");
}

export const tagList = (max: number | null, label: string) =>
  z
    .array(
      z
        .string()
        .transform((t) => t.trim().replace(/\s+/g, " "))
        .pipe(z.string().min(1, { message: "Порожній тег." }).max(80, { message: "Тег до 80 символів." })),
    )
    .superRefine((tags, ctx) => {
      if (max !== null && tags.length > max) {
        ctx.addIssue({ code: "custom", message: `${label}: не більше ${max}.` });
      }
      const seen = new Set<string>();
      for (const tag of tags) {
        const key = normalizeTag(tag);
        if (seen.has(key)) {
          ctx.addIssue({ code: "custom", message: `${label}: «${tag}» повторюється.` });
          return;
        }
        seen.add(key);
      }
    });

export const skillsSchema = tagList(MAX_SKILLS, "Skills");
export const categoriesSchema = tagList(50, "Categories");

/** First issue message of a failed parse, for toasts and form-level errors. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Дані не пройшли перевірку.";
}
