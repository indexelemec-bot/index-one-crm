import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

describe("timeline comercial", () => {
  beforeEach(() => vi.mocked(createClient).mockResolvedValue(null));

  it("acepta un opportunityId UUID válido y continúa hasta el servicio", async () => {
    const response = await GET(new Request("https://crm.example.com/api/communications/timeline?opportunityId=11111111-1111-4111-8111-111111111111"));
    expect(response.status).toBe(503);
  });

  it("rechaza un identificador inválido", async () => {
    const response = await GET(new Request("https://crm.example.com/api/communications/timeline?opportunityId=invalido"));
    expect(response.status).toBe(400);
  });
});
