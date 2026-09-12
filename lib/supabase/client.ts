import { createBrowserClient } from "@supabase/ssr";

export const isSupabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient(){
  if(!isSupabaseConfigured)return null;
  if(!browserClient) browserClient=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return browserClient;
}
