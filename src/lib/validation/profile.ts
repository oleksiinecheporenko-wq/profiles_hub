import { z } from "zod";
import {
  BILLING_METHODS,
  EXPERIENCE_LEVELS,
  LANGUAGE_LEVELS,
  PROFILE_STATUSES,
  PROFILE_VISIBILITIES,
} from "@/lib/domain/enums";
import { LANGUAGES } from "@/lib/reference/languages";
import { isValidTimeZone } from "@/lib/reference/timezones";
import {
  MAX_SHORT_TEXT,
  categoriesSchema,
  optionalEmail,
  optionalText,
  optionalUrl,
  requiredText,
} from "./common";
import { titleSchema } from "./version";

export const profileStatusSchema = z.enum(PROFILE_STATUSES);

export const createProfileSchema = z.object({
  fullName: requiredText(200, "Вкажіть ПІБ."),
  status: profileStatusSchema.default("active"),
  title: titleSchema,
  profileUrl: optionalUrl,
  photoPath: optionalText(500),
});

const timeZoneSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z
    .string()
    .refine(isValidTimeZone, {
      message: "Оберіть часовий пояс зі списку.",
    })
    .nullable(),
);

/** Account fields of `Основна інформація`; each key is optional, null clears the value. */
export const profileFieldsPatchSchema = z
  .object({
    visibility: z.enum(PROFILE_VISIBILITIES).nullable(),
    experienceLevel: z.enum(EXPERIENCE_LEVELS).nullable(),
    education: optionalText(MAX_SHORT_TEXT * 3),
    categories: categoriesSchema,
    email: optionalEmail,
    billingMethod: z.enum(BILLING_METHODS).nullable(),
    timeZone: timeZoneSchema,
    address: optionalText(MAX_SHORT_TEXT),
    phone: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z
        .string()
        .trim()
        .max(40, { message: "Не більше 40 символів." })
        .regex(/^[+\d\s()-]+$/, { message: "Телефон: лише цифри, пробіли, +, -, ( )." })
        .nullable(),
    ),
    profileUrl: optionalUrl,
    photoPath: optionalText(500),
  })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: "Немає змін для збереження." });

export const statusChangeSchema = z.object({
  status: profileStatusSchema,
  reason: optionalText(1000),
});

export const languagesSchema = z
  .array(
    z.object({
      language: z.enum(LANGUAGES, { message: "Оберіть мову зі списку." }),
      level: z.enum(LANGUAGE_LEVELS, { message: "Оберіть рівень." }),
    }),
  )
  .max(30)
  .refine((rows) => new Set(rows.map((r) => r.language)).size === rows.length, {
    message: "Мова вказана двічі.",
  });

export type CreateProfileInput = z.output<typeof createProfileSchema>;
export type ProfileFieldsPatch = z.output<typeof profileFieldsPatchSchema>;
export type LanguageInput = z.output<typeof languagesSchema>[number];
