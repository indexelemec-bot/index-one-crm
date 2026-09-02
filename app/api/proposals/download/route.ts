import { NextResponse } from "next/server";
import { z } from "zod";
import { loadProposalDeliveryFile } from "@/lib/proposals/load-delivery-file";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const querySchema = z.object({ id: z.string().uuid() });

export async function GET(request: Request) {
  const parsed = querySchema.safeParse({ id: new URL(request.url).searchParams.get("id") });
  if (!parsed.success) return NextResponse.json({ error: "Propuesta inválida." }, { status: 400 });

  const supabase = await createClient();
  const { data: authData } = await supabase?.auth.getUser() ?? { data: { user: null } };
  if (!supabase || !authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  try {
    const { file } = await loadProposalDeliveryFile(supabase, parsed.data.id);
    return new NextResponse(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible descargar esta propuesta.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
