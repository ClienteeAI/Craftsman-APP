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

/**
 * Retry na PŘECHODNÉ síťové chyby (studené spojení, TLS, výpadek Wi-Fi na
 * střeše). supabase-js vrátí { error } — když vypadá přechodně, zkusíme to
 * znovu s krátkým odstupem. Skutečné chyby (porušený constraint apod.) vrací
 * hned, ať se nic zbytečně neopakuje.
 *
 * Pro zákaznicky viditelné zápisy (nabídka, video) — jedno zaškobrtnutí sítě
 * nesmí shodit odeslání nabídky.
 */
export async function withDbRetry<T>(
  fn: () => PromiseLike<{ data: T; error: { message?: string } | null }>,
  tries = 3,
): Promise<{ data: T; error: { message?: string } | null }> {
  let result: { data: T; error: { message?: string } | null } = { data: null as T, error: null };
  for (let i = 0; i < tries; i++) {
    result = await fn();
    if (!result.error) return result;
    const msg = String(result.error.message ?? "");
    const transient = /fetch failed|network|timeout|ECONNRESET|EAI_AGAIN|socket|ETIMEDOUT/i.test(msg);
    if (!transient || i === tries - 1) return result;
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return result;
}
