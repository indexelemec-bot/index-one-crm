import { describe, expect, it } from "vitest";
import { commercialEmailAddress, commercialEmailFrom, resolveEmailProvider } from "@/lib/email/provider";

describe("proveedor de correo comercial", () => {
  it("prioriza Private Email cuando la contraseña SMTP está configurada", () => {
    expect(resolveEmailProvider({ PRIVATE_EMAIL_SMTP_PASSWORD: "secret", RESEND_API_KEY: "resend", EMAIL_FROM: "otro@ejemplo.com" })).toEqual({
      kind: "private_email",
      from: commercialEmailFrom,
      replyTo: commercialEmailAddress,
    });
  });

  it("mantiene Resend como alternativa y exige una configuración completa", () => {
    expect(resolveEmailProvider({ RESEND_API_KEY: "resend", EMAIL_FROM: "INDEX CONDO <correo@ejemplo.com>" })?.kind).toBe("resend");
    expect(resolveEmailProvider({ RESEND_API_KEY: "resend" })).toBeUndefined();
  });
});
