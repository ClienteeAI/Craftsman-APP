import { NextRequest, NextResponse } from "next/server";
import { generateWorkOrder } from "@/lib/quote/workorder";
import { isUnauthenticated } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Položky nabídky + parametry → pracovní příkaz pro partu v jejím jazyce. */
export async function POST(req: NextRequest) {
  if (await isUnauthenticated())
    return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  try {
    const body = await req.json();
    const text = await generateWorkOrder({
      lang: String(body.lang ?? "uk"),
      obec: body.obec ?? null,
      summary: body.summary ?? null,
      materials: Array.isArray(body.materials) ? body.materials : [],
      warnings: Array.isArray(body.warnings) ? body.warnings : [],
    });
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba";
    console.error("[workorder]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
