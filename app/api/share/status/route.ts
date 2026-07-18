import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { currentUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hromadný stav nabídek přihlášeného řemeslníka (otevřeno / zájem).
 *
 * Kvůli automatickému follow-upu: appka si pro rozpracované nabídky jedním
 * dotazem zjistí, které zákazník otevřel a neozval se — a navrhne zavolat.
 * Vrací JEN nabídky, které patří přihlášenému (scoping podle user_id).
 */
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ statuses: [] }, { status: 401 });

  const db = getSupabase();
  if (!db) return NextResponse.json({ statuses: [] });

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ statuses: [] });
    }
    const { data, error } = await db
      .from("quotes")
      .select("id, opened_at, interested_at, created_at")
      .eq("user_id", userId)
      .in("id", ids.slice(0, 200));
    if (error) throw new Error(error.message);

    const statuses = (data ?? []).map((r) => ({
      id: r.id as string,
      openedAt: (r.opened_at as string) ?? null,
      interestedAt: (r.interested_at as string) ?? null,
      createdAt: r.created_at as string,
    }));
    return NextResponse.json({ statuses }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[share status]", err);
    return NextResponse.json({ error: "Načítanie stavu zlyhalo." }, { status: 500 });
  }
}
