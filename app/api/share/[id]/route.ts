import { NextResponse } from "next/server";
import { getQuote } from "@/lib/quote/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stav nabídky — hlavně jestli si ji zákazník otevřel.
 *
 * Tohle je nenápadně jedna z nejcennějších věcí v aplikaci. Řemeslník uvidí,
 * že se zákazník na nabídku právě dívá, a může zvednout telefon ve chvíli,
 * kdy o tom zákazník přemýšlí. Konkurence pošle PDF do mailu a čeká týden.
 *
 * Zatím se to zjišťuje dotazováním, dokud má majster obrazovku otevřenou.
 * Až budou push notifikace (potřebují DB), přijde mu to i do kapsy.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = getQuote(id);
  if (!q) return NextResponse.json({ error: "Ponuka neexistuje." }, { status: 404 });

  return NextResponse.json(
    { id: q.id, openedAt: q.openedAt, interestedAt: q.interestedAt, createdAt: q.createdAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
