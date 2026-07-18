import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { currentUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uloží odběr push notifikací k přihlášenému řemeslníkovi.
 *
 * Jeden řádek na zařízení (klíčem je endpoint). Když se řemeslník přihlásí
 * k odběru na telefonu i tabletu, notifikace přijde na obě.
 */
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const db = getSupabase();
  if (!db) return NextResponse.json({ ok: false });

  try {
    const sub = await req.json();
    if (!sub?.endpoint || !sub?.keys) {
      return NextResponse.json({ error: "Neplatný odber." }, { status: 400 });
    }
    const { error } = await db
      .from("push_subscriptions")
      .upsert({ user_id: userId, endpoint: sub.endpoint, keys: sub.keys }, { onConflict: "endpoint" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push subscribe]", err);
    return NextResponse.json({ error: "Uloženie odberu zlyhalo." }, { status: 500 });
  }
}
