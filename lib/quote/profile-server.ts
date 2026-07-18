import type { CraftsmanProfile } from "./profile";
import { getSupabase, withDbRetry } from "@/lib/supabase";

/**
 * Cloudová záloha profilu majstra (sazby, marže, DPH, logo, firma).
 *
 * Stejný model jako CRM: localStorage je primární, tohle je záloha a obnova.
 * Řeší "vyměním telefon a nastavuju sazby znova" — po přihlášení na novém
 * zařízení se stáhnou. Celý profil je jeden JSON blob, jsou to nastavení.
 *
 * Bez Supabase jsou funkce no-op a jede se čistě z localStorage.
 */

export function profileSyncEnabled(): boolean {
  return getSupabase() !== null;
}

export async function upsertProfileServer(profile: CraftsmanProfile, userId: string): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await withDbRetry(() =>
    db.from("profiles").upsert({
      user_id: userId,
      data: profile,
      updated_at: new Date().toISOString(),
    }),
  );
  if (error) throw new Error(`Záloha profilu zlyhala: ${error.message}`);
}

export async function getProfileServer(userId: string): Promise<CraftsmanProfile | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await withDbRetry(() =>
    db.from("profiles").select("data").eq("user_id", userId).maybeSingle(),
  );
  if (error) throw new Error(`Načítanie profilu zlyhalo: ${error.message}`);
  return (data?.data as CraftsmanProfile) ?? null;
}
