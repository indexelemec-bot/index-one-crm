import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildContractPdf } from "@/lib/contracts/generate-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({ versionId: z.string().uuid(), format: z.enum(["docx", "pdf"]).default("docx") });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Versión o formato inválido." }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase?.auth.getUser() ?? { data: { user: null } };
  if (!supabase || !auth.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data: version } = await supabase.from("contract_versions").select("file_path").eq("id", parsed.data.versionId).single();
  if (!version) return NextResponse.json({ error: "Versión no disponible." }, { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Almacenamiento no configurado." }, { status: 503 });
  const admin = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  let selectedPath = version.file_path;
  if (parsed.data.format === "pdf") {
    selectedPath = version.file_path.replace(/\.docx$/, ".pdf");
    const existing = await admin.storage.from("contract-files").download(selectedPath);
    if (existing.error) {
      const source = await admin.storage.from("contract-files").download(version.file_path);
      if (source.error || !source.data) return NextResponse.json({ error: source.error?.message ?? "No fue posible leer el contrato." }, { status: 500 });
      const pdfBytes = await buildContractPdf(new Uint8Array(await source.data.arrayBuffer()));
      const uploaded = await admin.storage.from("contract-files").upload(selectedPath, pdfBytes, { contentType: "application/pdf", upsert: true });
      if (uploaded.error) return NextResponse.json({ error: uploaded.error.message }, { status: 500 });
    }
  }
  const { data, error } = await admin.storage.from("contract-files").createSignedUrl(selectedPath, 60 * 15, { download: true });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ signedUrl: data.signedUrl, format: parsed.data.format });
}
