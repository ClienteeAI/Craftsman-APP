import { NextResponse } from "next/server";
import { markInterested } from "@/lib/quote/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Zákazník na nabídce ťukl "Mám záujem".
 *
 * Nejsilnější událost v celé apce — zákazník sám řekl ano. Zaznamenáme čas;
 * řemeslníkova obrazovka se na to ptá (polling /api/share/[id]) a hned to
 * ukáže, ať zvedne telefon, dokud je zákazník rozhodnutý.
 *
 * Voláno přes fetch s keepalive z tlačítka, které zároveň otvírá telefon —
 * proto musí odpovědět rychle a nikdy nespadnout tak, aby to zdrželo hovor.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const firstTime = await markInterested(id);
  return NextResponse.json({ ok: true, firstTime }, { headers: { "Cache-Control": "no-store" } });
}
