import { z } from "zod";
import { CONTRACT_STATUSES } from "@/lib/domain/enums";
import {
  MAX_DIALOG,
  MAX_LONG_TEXT,
  MAX_SHORT_TEXT,
  optionalMoney,
  plainDate,
  requiredText,
  uuid,
} from "./common";

/** Keeps pasted correspondence exactly as typed: no trimming inside, only blank → null. */
const verbatimText = (max: number) =>
  z.preprocess(
    (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
    z.string().max(max, { message: `Не більше ${max} символів.` }).nullable(),
  );

export const contractInputSchema = z.object({
  profileId: uuid,
  createdDate: plainDate,
  title: requiredText(MAX_SHORT_TEXT, "Вкажіть тайтл."),
  rate: optionalMoney,
  description: verbatimText(MAX_LONG_TEXT),
  dialog: verbatimText(MAX_DIALOG),
});

export const contractStatusSchema = z.enum(CONTRACT_STATUSES);

export const contractCommentSchema = z.object({
  body: requiredText(5000, "Коментар порожній."),
});

export type ContractInput = z.output<typeof contractInputSchema>;
