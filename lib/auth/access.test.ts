import { describe, expect, it } from "vitest";
import { isEnabledCrmProfile } from "./access";

describe("isEnabledCrmProfile", () => {
  it("permite únicamente un perfil existente, activo y no eliminado", () => {
    expect(isEnabledCrmProfile({ active: true, deleted_at: null })).toBe(true);
    expect(isEnabledCrmProfile({ active: false, deleted_at: null })).toBe(false);
    expect(isEnabledCrmProfile({ active: true, deleted_at: "2026-09-09T12:00:00Z" })).toBe(false);
    expect(isEnabledCrmProfile({ active: true })).toBe(false);
    expect(isEnabledCrmProfile(null)).toBe(false);
    expect(isEnabledCrmProfile(undefined)).toBe(false);
  });
});
