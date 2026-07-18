import { NextRequest, NextResponse } from "next/server";
import { renderAtmosphere } from "@/lib/gemini";
import { isUnauthenticated } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Atmosférické varianty vizualizace: léto, sníh, večer, „o 15 rokov".
 *
 * Bere hotový render (střechu s novou krytinou) a přemaluje mu náladu. To je ta
 * věc, kterou si zákazník uloží — „takto by to vyzeralo pri západe slnka".
 */

const VARIANTS: Record<string, string> = {
  leto:
    "make it a bright sunny summer day: clear blue sky, lush green trees and" +
    " lawn, warm midday sunlight and soft shadows.",
  sneh:
    "make it a calm snowy winter scene: fresh snow on the ground and a light" +
    " dusting on the roof, soft overcast winter light, bare trees.",
  vecer:
    "make it dusk / early evening: a warm sunset sky, and the windows of the" +
    " house glowing warmly as if lit from inside — a cosy evening mood.",
  starnutie:
    "show the same house about 15 years later: this quality roof stays clean," +
    " intact and free of moss or discolouration (it ages well), with gently" +
    " matured surroundings — slightly taller trees.",
};

export async function POST(req: NextRequest) {
  if (await isUnauthenticated())
    return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  try {
    const { image, variant } = await req.json();
    const atmosphere = VARIANTS[variant as string];
    if (!atmosphere) {
      return NextResponse.json({ error: "Neznáma varianta." }, { status: 400 });
    }
    if (typeof image !== "string" || !image.startsWith("data:")) {
      return NextResponse.json({ error: "Chýba obrázok." }, { status: 400 });
    }
    const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(image);
    if (!m) return NextResponse.json({ error: "Neplatný obrázok." }, { status: 400 });

    const buffer = Buffer.from(m[2], "base64");
    const out = await renderAtmosphere(buffer, m[1], atmosphere);

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba";
    console.error("[render variant]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
