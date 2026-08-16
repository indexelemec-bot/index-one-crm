import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const metaToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Supabase no configurado." }, { status: 503 });
  if (!metaToken || !openaiKey) return NextResponse.json({ error: "Faltan credenciales de WhatsApp u OpenAI para transcribir." }, { status: 503 });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: pending, error } = await admin.from("communications")
    .select("id,opportunity_id,provider_media_id,media_mime_type")
    .eq("channel", "whatsapp")
    .eq("direction", "inbound")
    .eq("message_type", "audio")
    .eq("transcription_status", "pending")
    .not("provider_media_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let completed = 0;
  let failed = 0;

  for (const item of pending ?? []) {
    await admin.from("communications").update({ transcription_status: "processing", transcription_error: null }).eq("id", item.id);
    try {
      const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
      const mediaMetaResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${item.provider_media_id}`, {
        headers: { Authorization: `Bearer ${metaToken}` }
      });
      const mediaMeta = await mediaMetaResponse.json().catch(() => ({}));
      if (!mediaMetaResponse.ok || !mediaMeta.url) throw new Error(mediaMeta.error?.message ?? "No fue posible localizar la nota de voz en WhatsApp.");

      const mediaResponse = await fetch(mediaMeta.url, { headers: { Authorization: `Bearer ${metaToken}` } });
      if (!mediaResponse.ok) throw new Error("No fue posible descargar la nota de voz de WhatsApp.");
      const audio = await mediaResponse.arrayBuffer();
      const mime = mediaResponse.headers.get("content-type") || String(item.media_mime_type || "audio/ogg");
      const extension = mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : mime.includes("mp4") ? "m4a" : "audio";

      const transcriptionForm = new FormData();
      transcriptionForm.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
      transcriptionForm.append("language", "es");
      transcriptionForm.append("file", new File([audio], `nota-voz-${item.id}.${extension}`, { type: mime }));
      const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: transcriptionForm
      });
      const transcription = await transcriptionResponse.json().catch(() => ({}));
      if (!transcriptionResponse.ok || !transcription.text) throw new Error(transcription.error?.message ?? "No fue posible transcribir la nota de voz.");

      const text = String(transcription.text).trim();
      const completedAt = new Date().toISOString();
      const storagePath = `${item.opportunity_id}/voice/${item.id}.${extension}`;
      await admin.storage.from("communication-files").upload(storagePath, Buffer.from(audio), { contentType: mime, upsert: true });
      await admin.from("communications").update({
        transcription_status: "completed",
        transcription_text: text,
        transcription_provider: process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe",
        transcription_language: "es",
        transcription_completed_at: completedAt,
        transcription_error: null,
        media_path: storagePath,
        media_name: `Nota de voz.${extension}`,
        media_mime_type: mime
      }).eq("id", item.id);
      completed += 1;
    } catch (cause) {
      failed += 1;
      await admin.from("communications").update({
        transcription_status: "failed",
        transcription_error: cause instanceof Error ? cause.message : "No fue posible transcribir la nota de voz."
      }).eq("id", item.id);
    }
  }

  return NextResponse.json({ ok: true, processed: pending?.length ?? 0, completed, failed });
}
