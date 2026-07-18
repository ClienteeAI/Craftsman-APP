import { NextRequest, NextResponse } from "next/server";
import { generateMarketing } from "@/lib/quote/marketing";
import { isUnauthenticated } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Z hotové zakázky → hotový FB příspěvek, prosba o recenzi, popisek portfolia. */
export async function POST(req: NextRequest) {
  if (await isUnauthenticated())
    return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  try {
    const body = await req.json();
    const assets = await generateMarketing({
      companyName: String(body.companyName ?? "Naša firma"),
      obec: body.obec ?? null,
      customerName: body.customerName ?? null,
      productName: body.productName ?? null,
      summary: body.summary ?? null,
    });
    return NextResponse.json(assets);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba";
    console.error("[marketing]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
