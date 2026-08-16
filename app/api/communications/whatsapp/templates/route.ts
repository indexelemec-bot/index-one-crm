import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  templateKey: z.string().trim().min(2).max(100).regex(/^[a-z0-9_]+$/),
  metaName: z.string().trim().min(2).max(512).regex(/^[a-z0-9_]+$/),
  languageCode: z.string().trim().min(2).max(20).default("es"),
  category: z.enum(["AUTHENTICATION", "MARKETING", "UTILITY"]).default("UTILITY"),
  description: z.string().trim().max(1000).optional(),
  bodyPreview: z.string().trim().max(4000).optional(),
  active: z.boolean().optional().default(true),
  approved: z.boolean().optional().default(false)
});

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  const { data, error } = await supabase.from("whatsapp_templates").select("*").eq("active", true).order("template_key", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisa la configuración de la plantilla." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const { data, error } = await supabase.from("whatsapp_templates").upsert({
    template_key: parsed.data.templateKey,
    meta_name: parsed.data.metaName,
    language_code: parsed.data.languageCode,
    category: parsed.data.category,
    description: parsed.data.description ?? null,
    body_preview: parsed.data.bodyPreview ?? null,
    active: parsed.data.active,
    approved: parsed.data.approved,
    created_by: authData.user.id,
    updated_at: new Date().toISOString()
  }, { onConflict: "template_key" }).select("*").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "No fue posible guardar la plantilla." }, { status: 500 });
  return NextResponse.json({ template: data });
}
