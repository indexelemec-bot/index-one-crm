import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/proposals/render-file", () => ({
  renderProposalFile: vi.fn().mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    fileName: "propuesta.pdf",
    contentType: "application/pdf",
  }),
}));

import { renderProposalFile } from "@/lib/proposals/render-file";
import { createClient } from "@/lib/supabase/server";
import { POST } from "./route";

const referenceIds = ["r1", "r2", "r3"];
const validBody = {
  opportunityId: "o1",
  monthlyFee: 42000,
  issueDate: "2026-09-09",
  referenceIds,
  format: "pdf",
  projectType: "comercial",
  clientName: "NOMBRE MANIPULADO",
  references: [{ clientName: "REFERENCIA MANIPULADA" }],
};

function request(body: Record<string, unknown> = validBody) {
  return new Request("https://crm.example.com/api/proposals/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authenticatedClient(referenceRows: Record<string, unknown>[]) {
  const results = {
    opportunities: { data: { id: "o1", account_id: "a1" }, error: null },
    accounts: {
      data: {
        id: "a1",
        name: "Plaza Autorizada",
        project_type: "comercial",
        residential_subtype: null,
        custom_unit_type: null,
      },
      error: null,
    },
  };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: vi.fn((table: "opportunities" | "accounts" | "references_catalog") => {
      if (table === "references_catalog") {
        let filters = 0;
        const query = {
          select: vi.fn(() => query),
          in: vi.fn(() => query),
          eq: vi.fn(() => {
            filters += 1;
            return filters === 3
              ? Promise.resolve({ data: referenceRows, error: null })
              : query;
          }),
        };
        return query;
      }
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn().mockResolvedValue(results[table]),
      };
      return query;
    }),
  };
}

const databaseReferences = referenceIds.map((id, index) => ({
  id,
  client_name: `Referencia DB ${index + 1}`,
  location: "Santo Domingo",
  units: 20 + index,
  account_type: "proyecto_nuevo",
  project_type: "comercial",
  profile: "corporativo",
  approved: true,
  active: true,
  preferred: false,
  priority: 50,
  incorporated_at: "2026-09-01",
  contact_share_authorized: false,
}));

describe("generación segura de propuestas", () => {
  afterEach(() => vi.clearAllMocks());

  it("rechaza solicitudes sin una sesión válida", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as never);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(renderProposalFile).not.toHaveBeenCalled();
  });

  it("rechaza IDs de referencia duplicados antes de consultar Supabase", async () => {
    const response = await POST(
      request({ ...validBody, referenceIds: ["r1", "r1", "r2"] }),
    );

    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
    expect(renderProposalFile).not.toHaveBeenCalled();
  });

  it("renderiza solo con cuenta y referencias recuperadas bajo RLS", async () => {
    vi.mocked(createClient).mockResolvedValue(
      authenticatedClient(databaseReferences) as never,
    );

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(renderProposalFile).toHaveBeenCalledWith(
      "pdf",
      expect.objectContaining({
        clientName: "Plaza Autorizada",
        projectType: "comercial",
        references: expect.arrayContaining([
          expect.objectContaining({ clientName: "Referencia DB 1" }),
        ]),
      }),
    );
    expect(renderProposalFile).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clientName: "NOMBRE MANIPULADO" }),
    );
  });

  it("rechaza referencias que no se resuelven como terna autorizada", async () => {
    vi.mocked(createClient).mockResolvedValue(
      authenticatedClient(databaseReferences.slice(0, 2)) as never,
    );

    const response = await POST(request());

    expect(response.status).toBe(422);
    expect(renderProposalFile).not.toHaveBeenCalled();
  });
});
