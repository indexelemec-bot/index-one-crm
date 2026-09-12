import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("migración de snapshots históricos", () => {
  it("falla antes del backfill y exige exactamente tres referencias", async () => {
    const sql = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/20260908171353_project_classification_and_commercial_references.sql",
      ),
      "utf8",
    );
    const preflight = sql.indexOf("Preflight falló");
    const addSnapshot = sql.indexOf("add column if not exists references_snapshot");

    expect(preflight).toBeGreaterThan(0);
    expect(preflight).toBeLessThan(addSnapshot);
    expect(sql).toContain("jsonb_array_length(references_snapshot) = 3");
    expect(sql).toContain("alter column project_type set not null");
    expect(sql).toContain("new.reference_ids is distinct from old.reference_ids");
    expect(sql).toContain("revoke update on table public.proposals from authenticated");
    expect(sql).toContain("grant update(status, sent_at) on table public.proposals to authenticated");
  });
});
