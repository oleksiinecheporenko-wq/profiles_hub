import { describe, expect, it } from "vitest";
import {
  ACCESS_COOKIE_MAX_AGE_SECONDS,
  createAccessToken,
  passwordMatches,
  safeNextPath,
  verifyAccessToken,
} from "./token";

const SECRET = "test-secret";

describe("access token", () => {
  it("accepts a fresh token signed with the same secret", async () => {
    const token = await createAccessToken(SECRET);
    expect(await verifyAccessToken(SECRET, token)).toBe(true);
  });

  it("rejects a token signed with another secret", async () => {
    const token = await createAccessToken("other");
    expect(await verifyAccessToken(SECRET, token)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const issuedAt = Date.now() - ACCESS_COOKIE_MAX_AGE_SECONDS * 1000 - 1000;
    const token = await createAccessToken(SECRET, issuedAt);
    expect(await verifyAccessToken(SECRET, token)).toBe(false);
  });

  it("rejects a token with a tampered expiry", async () => {
    const token = await createAccessToken(SECRET);
    const [, signature] = token.split(".");
    const forged = `${Date.now() + 10 ** 12}.${signature}`;
    expect(await verifyAccessToken(SECRET, forged)).toBe(false);
  });

  it("rejects missing and malformed tokens", async () => {
    for (const t of [undefined, "", "abc", "1.2.3", "x.y"]) {
      expect(await verifyAccessToken(SECRET, t)).toBe(false);
    }
  });

  it("compares passwords", async () => {
    expect(await passwordMatches(SECRET, "hunter2", "hunter2")).toBe(true);
    expect(await passwordMatches(SECRET, "hunter", "hunter2")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/contracts?x=1")).toBe("/contracts?x=1");
  });

  it("falls back for external or odd targets", () => {
    for (const v of ["https://evil.test", "//evil.test", "/\\evil.test", "/access", null, 5]) {
      expect(safeNextPath(v)).toBe("/profiles");
    }
  });
});
