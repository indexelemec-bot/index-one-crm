import { describe, expect, it } from "vitest";
import { renderCommunicationTemplate } from "@/lib/communication-templates";

describe("communication templates", () => {
  it("personaliza cliente y contacto sin dejar marcadores", () => {
    const result = renderCommunicationTemplate("propuesta", "Torre Aurora", "María");
    expect(result.subject).toContain("Torre Aurora");
    expect(result.body).toContain("María");
    expect(result.body).not.toContain("{{");
  });
});
