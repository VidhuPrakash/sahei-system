import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone.util.js";

describe("normalizePhone", () => {
  it.each(["9847012345", "09847012345", "+91 98470 12345", "919847012345", "+91-98470-12345"])(
    "normalizes %s to +919847012345",
    (raw) => {
      expect(normalizePhone(raw)).toBe("+919847012345");
    },
  );

  it("does not equate a different number", () => {
    expect(normalizePhone("9847012345")).not.toBe(normalizePhone("9999999999"));
  });
});
