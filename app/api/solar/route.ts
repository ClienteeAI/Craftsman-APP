import { NextRequest, NextResponse } from "next/server";
import { estimateSolar } from "@/lib/quote/solar";
import { isUnauthenticated } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Sklon + orientace + plocha → orientační roční výroba FV (PVGIS, zdarma). */
export async function POST(req: NextRequest) {
  if (await isUnauthenticated())
    return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  try {
    const body = await req.json();
    const area = Number(body.areaM2);
    if (!Number.isFinite(area) || area <= 0) {
      return NextResponse.json({ error: "Chýba plocha strechy." }, { status: 400 });
    }
    const est = await estimateSolar({
      obec: body.obec ?? null,
      areaM2: area,
      pitchDeg: body.pitchDeg ?? null,
      aspect: typeof body.aspect === "number" ? body.aspect : 0,
    });
    if (!est) {
      return NextResponse.json({ error: "Odhad sa nepodaril (PVGIS nedostupné)." }, { status: 502 });
    }
    return NextResponse.json(est);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba";
    console.error("[solar]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
