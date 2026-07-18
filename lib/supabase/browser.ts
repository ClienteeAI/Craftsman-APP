import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase klient pro PROHLÍŽEČ (přihlášení řemeslníka).
 *
 * Používá VEŘEJNÝ anon klíč — je bezpečné mít ho v klientu, přístup hlídá RLS
 * podle přihlášeného uživatele. Session se drží v cookies (čte je i server).
 *
 * Když anon klíč není nastavený, vrací null — appka pak ví, že přihlášení
 * ještě není nakonfigurované, a řekne to místo pádu.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  return createBrowserClient(url, anonKey);
}

export function authConfigured(): boolean {
  return Boolean(url && anonKey);
}
