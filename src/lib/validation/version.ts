import { z } from "zod";
import { COLLECTION_FIELDS } from "@/lib/domain/types";
import {
  MAX_DESCRIPTION,
  MAX_LONG_TEXT,
  MAX_SHORT_TEXT,
  optionalMoney,
  optionalPlainDate,
  optionalText,
  optionalUrl,
  plainDate,
  requiredText,
  skillsSchema,
  uuid,
} from "./common";

export const titleSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(MAX_SHORT_TEXT, { message: `Title: не більше ${MAX_SHORT_TEXT} символів.` }).nullable(),
);
export const descriptionSchema = optionalText(MAX_DESCRIPTION).refine(
  (v) => v === null || v.length <= MAX_DESCRIPTION,
  { message: `Description: не більше ${MAX_DESCRIPTION} символів.` },
);
export const rateSchema = optionalMoney;

// Collection items: stored JSON documents with stable ids (Part A, section 5).

export const portfolioItemSchema = z.object({
  id: uuid,
  title: requiredText(MAX_SHORT_TEXT, "Вкажіть назву."),
  description: optionalText(MAX_LONG_TEXT),
  url: optionalUrl,
  image_path: optionalText(500),
});

export const projectCatalogItemSchema = z.object({
  id: uuid,
  title: requiredText(MAX_SHORT_TEXT, "Вкажіть назву."),
  description: optionalText(MAX_LONG_TEXT),
  price: optionalMoney,
  url: optionalUrl,
});

export const certificationSchema = z
  .object({
    id: uuid,
    title: requiredText(MAX_SHORT_TEXT, "Вкажіть назву."),
    issuer: optionalText(MAX_SHORT_TEXT),
    date_from: optionalPlainDate,
    date_to: optionalPlainDate,
    description: optionalText(MAX_LONG_TEXT),
  })
  .refine((v) => !v.date_from || !v.date_to || v.date_from <= v.date_to, {
    message: "Дата завершення раніша за дату початку.",
    path: ["date_to"],
  });

export const employmentItemSchema = z
  .object({
    id: uuid,
    company: requiredText(MAX_SHORT_TEXT, "Вкажіть компанію."),
    position: optionalText(MAX_SHORT_TEXT),
    date_from: optionalPlainDate,
    date_to: optionalPlainDate,
    description: optionalText(MAX_LONG_TEXT),
  })
  .refine((v) => !v.date_from || !v.date_to || v.date_from <= v.date_to, {
    message: "Дата завершення раніша за дату початку.",
    path: ["date_to"],
  });

export const otherExperienceSchema = z.object({
  id: uuid,
  title: requiredText(MAX_SHORT_TEXT, "Вкажіть назву."),
  description: optionalText(MAX_LONG_TEXT),
});

export const collectionItemSchemas = {
  portfolio: portfolioItemSchema,
  project_catalog: projectCatalogItemSchema,
  certifications: certificationSchema,
  employment_history: employmentItemSchema,
  other_experiences: otherExperienceSchema,
} as const;

const uniqueIds = <T extends { id: string }>(items: T[]) =>
  new Set(items.map((i) => i.id)).size === items.length;

const collection = <S extends z.ZodType<{ id: string }>>(item: S) =>
  z.array(item).refine(uniqueIds, { message: "Елементи колекції мають повторювані id." });

export const versionContentSchema = z.object({
  title: titleSchema,
  rate: rateSchema,
  description: descriptionSchema,
  skills: skillsSchema,
  portfolio: collection(portfolioItemSchema),
  project_catalog: collection(projectCatalogItemSchema),
  certifications: collection(certificationSchema),
  employment_history: collection(employmentItemSchema),
  other_experiences: collection(otherExperienceSchema),
  additional_info: optionalText(MAX_LONG_TEXT),
});

export const versionPayloadSchema = z.object({
  updateDate: plainDate,
  content: versionContentSchema,
});

const collectionField = z.enum(COLLECTION_FIELDS);

/** Validates a daily change, including the item shape of its collection. */
export const dailyChangeSchema = z
  .union([
    z.object({ field: z.literal("title"), value: titleSchema }),
    z.object({ field: z.literal("description"), value: descriptionSchema }),
    z.object({ field: z.literal("rate"), value: rateSchema }),
    z.object({ field: z.literal("skills"), value: skillsSchema }),
    z.object({
      field: collectionField,
      op: z.literal("add"),
      item: z.record(z.string(), z.unknown()),
      index: z.number().int().min(0).optional(),
    }),
    z.object({ field: collectionField, op: z.literal("update"), item: z.record(z.string(), z.unknown()) }),
    z.object({ field: collectionField, op: z.literal("remove"), itemId: uuid }),
    z.object({ field: collectionField, op: z.literal("reorder"), ids: z.array(uuid) }),
  ])
  .transform((change, ctx) => {
    if ("item" in change) {
      const parsed = collectionItemSchemas[change.field].safeParse(change.item);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({ code: "custom", message: issue.message, path: ["item", ...issue.path] });
        }
        return z.NEVER;
      }
      return { ...change, item: parsed.data };
    }
    return change;
  });
