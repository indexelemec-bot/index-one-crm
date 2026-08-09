import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, normalizeWhatsAppPhone } from "@/lib/whatsapp";

describe("WhatsApp proposal delivery", () => {
  it("normalizes Dominican phone numbers", () => {
    expect(normalizeWhatsAppPhone("(809) 555-0142")).toBe("18095550142");
  });

  it("builds an encoded wa.me URL", () => {
    expect(buildWhatsAppUrl("+1 809 555 0142", "Propuesta lista: https://example.com/a b")).toContain("https://wa.me/18095550142?text=Propuesta%20lista");
  });
});
