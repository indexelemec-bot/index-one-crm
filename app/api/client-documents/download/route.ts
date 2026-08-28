import { NextResponse } from "next/server";
import { z } from "zod";
import { loadClientDocumentFile } from "@/lib/client-documents/load-file";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  try {
    const { file } = await loadClientDocumentFile(supabase, id.data);
    return new NextResponse(Buffer.from(file.bytes), { headers: { "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="${file.fileName}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible descargar el documento." }, { status: 404 });
  }
}
