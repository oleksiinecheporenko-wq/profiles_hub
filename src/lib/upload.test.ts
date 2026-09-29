import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, precheckImage, readImage } from "./upload";

const file = (bytes: number[], type: string, name = "f") => new File([new Uint8Array(bytes)], name, { type });
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff, 0xe0];
const WEBP = [...Array.from("RIFF", (c) => c.charCodeAt(0)), 0, 0, 0, 0, ...Array.from("WEBP", (c) => c.charCodeAt(0))];

describe("image upload checks", () => {
  it("detects the type from magic bytes, not the declared type", async () => {
    expect(await readImage(file(PNG, "image/jpeg"))).toMatchObject({ ok: true, upload: { contentType: "image/png" } });
    expect(await readImage(file(JPG, "image/png"))).toMatchObject({ ok: true, upload: { contentType: "image/jpeg" } });
    expect(await readImage(file(WEBP, "image/webp"))).toMatchObject({ ok: true, upload: { contentType: "image/webp" } });
  });

  it("rejects other formats, empty and oversized files", async () => {
    expect((await readImage(file([0x47, 0x49, 0x46, 0x38], "image/png"))).ok).toBe(false);
    expect((await readImage(file([], "image/png"))).ok).toBe(false);
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "big.png", { type: "image/png" });
    expect((await readImage(big)).ok).toBe(false);
  });

  it("prechecks declared type and size in the browser", () => {
    expect(precheckImage(file(PNG, "image/png"))).toBeNull();
    expect(precheckImage(file(PNG, "image/gif"))).not.toBeNull();
  });
});
