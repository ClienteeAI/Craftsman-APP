import { NextRequest, NextResponse } from "next/server";
import { normalizePhoto } from "@/lib/composite";
import { inspectRoof } from "@/lib/quote/inspect";
import { isUnauthenticated } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Fotka střechy → co je na ní vidět. Pomůcka pro majstra před nabídkou. */
export async function POST(req: NextRequest) {
  if (await isUnauthenticated())
    return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  try {
    const form = await req.formData();
    const photo = form.get("photo");
    if (!(photo instanceof Blob)) {
      return NextResponse.json({ error: "Chýba fotka." }, { status: 400 });
    }

    const normalized = await normalizePhoto(Buffer.from(await photo.arrayBuffer()));
    const inspection = await inspectRoof(normalized, "image/png");

    return NextResponse.json(inspection);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba";
    console.error("[inspect]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
