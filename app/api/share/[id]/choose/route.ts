import { NextRequest, NextResponse } from "next/server";
import { chooseTier } from "@/lib/quote/store";
import { notifyQuoteOwner } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zákazník si vybral cenovú úroveň. Uloží volbu + dá vědět majstrovi. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tier } = await req.json();
  if (typeof tier !== "string" || !tier) {
    return NextResponse.json({ error: "Chýba voľba." }, { status: 400 });
  }
  const firstTime = await chooseTier(id, tier);
  if (firstTime) {
    await notifyQuoteOwner(id, {
      title: "🔥 Zákazník si vybral!",
      body: "Vybral si cenovú úroveň. Zavolaj mu, dokým je rozhodnutý.",
      url: "/zakazky",
      tag: `choose-${id}`,
    });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
