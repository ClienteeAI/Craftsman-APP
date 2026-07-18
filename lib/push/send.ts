import webpush from "web-push";
import { getSupabase } from "@/lib/supabase";

/**
 * Odeslání push notifikace majiteli nabídky (serverová strana).
 *
 * Když zákazník otevře nabídku nebo ťukne „Mám záujem", tohle najde řemeslníka,
 * kterému nabídka patří, a pošle mu notifikaci na všechna jeho zařízení — i
 * když má appku zavřenou. To je celé to „zavolej ve správný moment" i do kapsy.
 *
 * Nikdy nesmí shodit zákazníkovu akci: všechno je best-effort, chyby jen loguje.
 * Mrtvé odběry (404/410) rovnou maže, ať se databáze nezanáší.
 */

let ready: boolean | null = null;

function ensureConfigured(): boolean {
  if (ready !== null) return ready;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    ready = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  ready = true;
  return true;
}

type Payload = { title: string; body: string; url?: string; tag?: string };

/** Pošle notifikaci majiteli dané nabídky (podle quotes.user_id). */
export async function notifyQuoteOwner(quoteId: string, payload: Payload): Promise<void> {
  const db = getSupabase();
  if (!db || !ensureConfigured()) return;

  try {
    const { data: quote } = await db
      .from("quotes")
      .select("user_id")
      .eq("id", quoteId)
      .maybeSingle();
    const ownerId = quote?.user_id as string | null | undefined;
    if (!ownerId) return; // starší nabídka bez majitele / demo bez auth

    const { data: subs } = await db
      .from("push_subscriptions")
      .select("endpoint, keys")
      .eq("user_id", ownerId);
    if (!subs?.length) return;

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint as string, keys: s.keys as { p256dh: string; auth: string } },
            JSON.stringify(payload),
          );
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            // Odběr už neplatí (odinstalováno/odhlášeno) — ukliď ho.
            await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          } else {
            console.error("[push send]", code, err);
          }
        }
      }),
    );
  } catch (err) {
    console.error("[push notifyQuoteOwner]", err);
  }
}
