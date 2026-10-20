import { describe, expect, it } from "vitest";
import { nextStepsSchema } from "@/lib/validation/estimate";
import { DEFAULT_NEXT_STEPS, effectiveNextSteps } from "./estimate";

describe("next steps", () => {
  it("falls back to the standard steps", () => {
    expect(effectiveNextSteps(null)).toBe(DEFAULT_NEXT_STEPS);
    expect(effectiveNextSteps([{ id: "a", title: "  ", text: "x" }])).toBe(DEFAULT_NEXT_STEPS);
    const own = [{ id: "a", title: "Workshop", text: "" }];
    expect(effectiveNextSteps(own)).toEqual(own);
  });

  it("drops untitled steps and stores an empty list as null", () => {
    expect(nextStepsSchema.parse([])).toBeNull();
    expect(nextStepsSchema.parse([{ id: "a", title: " ", text: "x" }])).toBeNull();
    expect(nextStepsSchema.parse([{ id: "a", title: " Call ", text: "" }])).toEqual([{ id: "a", title: "Call", text: "" }]);
    expect(nextStepsSchema.safeParse(Array.from({ length: 7 }, (_, i) => ({ id: `${i}`, title: "t", text: "" }))).success).toBe(false);
  });
});
