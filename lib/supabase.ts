import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Jediné místo, kde vzniká spojení na Supabase.
 *
 * ═══ PROČ TAKHLE ═══
 * Celá databáze je „odhoditelná": klíče žijí JEN v env proměnných, schéma je
 * jako SQL migrace v gitu (supabase/migrations). Nový projekt na Supabase +
 * spuštění migrace = identická databáze. Smažeš projekt → zmizí jen data,
 * kód i schéma zůstávají. Přehození na nový projekt = vyměnit dva klíče.
 *
 * ═══ FALLBACK ═══
 * Když klíče nejsou nastavené, vrací null. Volající si pak sáhne na in-memory /
 * localStorage variantu — takže demo běží i bez Supabase a v momentě, kdy
 * majitel vloží klíče, se to přepne na ostrý provoz bez zásahu do kódu.
 *
 * Service-role klíč = plný přístup, PATŘÍ JEN NA SERVER (API routes, RSC).
 * Nikdy ne do klientského bundlu — proto tu není NEXT_PUBLIC_ prefix.
 */

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cached: SupabaseClient | null = null;

/** Vrátí serverového klienta, nebo null když Supabase není nakonfigurované. */
export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  if (!url || !serviceKey) return null;
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Rychlá kontrola do logů/diagnostiky — běží appka na DB, nebo na paměti? */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && serviceKey);
}
