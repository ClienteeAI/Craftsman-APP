import { NextRequest, NextResponse } from "next/server";
import { saveQuote } from "@/lib/quote/store";

export const runtime = "nodejs";

/** Uloží nabídku a vrátí odkaz, který jde poslat zákazníkovi. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.items?.length) {
      return NextResponse.json({ error: "Ponuka je prázdna." }, { status: 400 });
    }

    const saved = await saveQuote({
      company: body.company,
      customer: body.customer ?? { name: null, obec: null, phone: null, email: null },
      summary: String(body.summary ?? ""),
      tierName: String(body.tierName ?? ""),
      productName: String(body.productName ?? ""),
      earliestTerm: String(body.earliestTerm ?? ""),
      items: body.items,
      totals: body.totals,
      range: body.range,
      assumptions: body.assumptions ?? [],
      imageDataUrl: body.imageDataUrl ?? null,
      videoId: body.videoId ?? null,
    });

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    return NextResponse.json({ id: saved.id, url: `${origin}/p/${saved.id}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba";
    console.error("[share]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
