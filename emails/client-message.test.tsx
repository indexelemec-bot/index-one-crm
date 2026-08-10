import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClientMessageEmail } from "@/emails/client-message";

describe("correo comercial de clientes", () => {
  it("usa la identidad INDEX CONDO y el buzón comercial", () => {
    const html = renderToStaticMarkup(ClientMessageEmail({
      clientName: "Condominio Vista Azul",
      recipientName: "María Pérez",
      body: "Adjuntamos nuestra propuesta.",
      senderName: "Laura Méndez",
      attachmentName: "propuesta.pdf",
    }));

    expect(html).toContain("INDEX CONDO");
    expect(html).toContain("ventas@indexelemecsrl.com");
    expect(html).toContain("propuesta.pdf");
    expect(html).not.toContain("INDEX ONE");
  });
});
