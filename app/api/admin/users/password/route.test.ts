import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { POST } from "./route";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";

function request(body: Record<string, unknown>) {
  return new Request("https://crm.example.com/api/admin/users/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function userClient(role: string) {
  let profileLookup = 0;
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: actorId } }, error: null }) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => {
          profileLookup += 1;
          return profileLookup === 1
            ? { single: vi.fn().mockResolvedValue({ data: { role, active: true, deleted_at: null } }) }
            : { maybeSingle: vi.fn().mockResolvedValue({ data: { id: targetId, full_name: "Usuario Prueba", deleted_at: null }, error: null }) };
        })
      }))
    }))
  };
}

describe("cambio administrativo de contraseña", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-secret";
  });

  afterEach(() => vi.clearAllMocks());

  it("rechaza a un rol distinto de superadmin antes de crear el cliente privilegiado", async () => {
    vi.mocked(createClient).mockResolvedValue(userClient("ejecutivo") as never);

    const response = await POST(request({ userId: targetId, password: "ClaveSegura22!", confirmation: "ClaveSegura22!" }));

    expect(response.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rechaza una confirmación distinta", async () => {
    const response = await POST(request({ userId: targetId, password: "ClaveSegura22!", confirmation: "OtraClaveSegura22!" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Las contraseñas no coinciden." });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("actualiza Auth y audita actor y objetivo sin guardar la contraseña", async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const auditEq = vi.fn().mockResolvedValue({ error: null });
    const auditUpdate = vi.fn(() => ({ eq: auditEq }));
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      auth: { admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user: { id: targetId } }, error: null }),
        updateUserById
      } },
      from: vi.fn(() => ({ insert: auditInsert, update: auditUpdate }))
    };
    vi.mocked(createClient).mockResolvedValue(userClient("superadmin") as never);
    vi.mocked(createAdminClient).mockReturnValue(admin as never);

    const response = await POST(request({ userId: targetId, password: "ClaveSegura22!", confirmation: "ClaveSegura22!" }));

    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith(targetId, { password: "ClaveSegura22!" });
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      actor_user_id: actorId,
      target_user_id: targetId,
      status: "requested"
    }));
    expect(auditInsert.mock.calls[0][0]).not.toHaveProperty("password");
    expect(auditUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "succeeded" }));
  });
});
