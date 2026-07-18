import { NextRequest, NextResponse } from "next/server";
import { signQuote } from "@/lib/quote/store";
import { notifyQuoteOwner } from "@/lib/push/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zákazník nabídku závazně podepsal. Uloží podpis + dá vědět majstrovi. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { signature } = await req.json();
  if (typeof signature !== "string" || !signature.startsWith("data:")) {
    return NextResponse.json({ error: "Chýba podpis." }, { status: 400 });
  }
  const firstTime = await signQuote(id, signature);
  if (firstTime) {
    await notifyQuoteOwner(id, {
      title: "✍️ Zákazník podpísal!",
      body: "Nabídku závazně podpísal. Ozvi sa mu a dohodni termín.",
      url: "/zakazky",
      tag: `sign-${id}`,
    });
  }
  return NextResponse.json({ ok: true, firstTime }, { headers: { "Cache-Control": "no-store" } });
}
