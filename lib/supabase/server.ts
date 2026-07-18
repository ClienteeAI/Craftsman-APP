import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Supabase klient pro SERVER (RSC, route handlery) svázaný s přihlášeným
 * uživatelem přes cookies. Tímhle klientem zjistíme, KDO je přihlášený
 * (auth.getUser()) a scopujeme jeho data.
 *
 * cookies() je v téhle verzi Next asynchronní — proto await.
 * Null když auth není nakonfigurované (chybí anon klíč).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createClient(): Promise<SupabaseClient | null> {
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // V RSC nejde zapisovat cookies — refresh session řeší middleware.
        // Proto try/catch, ať to v komponentě jen tiše přeskočí.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* volání z RSC — ignorujeme, cookies obnoví middleware */
        }
      },
    },
  });
}

/** Vrátí id přihlášeného řemeslníka, nebo null. Základ scopingu dat. */
export async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
