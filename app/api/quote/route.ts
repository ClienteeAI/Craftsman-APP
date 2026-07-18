import { NextRequest, NextResponse } from "next/server";
import { extractJob } from "@/lib/quote/extract";
import { DEFAULT_PROFILE, type CraftsmanProfile } from "@/lib/quote/profile";
import { computeTakeoff } from "@/lib/quote/takeoff";
import { buildTiers } from "@/lib/quote/tiers";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Celá smyčka: řeč → parametry → výkaz → tři oceněné hladiny.
 *
 * Přijímá buď `transcript` (majster mluvil), nebo rovnou `job` (doplnil
 * odpověď na doptání a posíláme upravené parametry zpátky).
 * Volitelně `profile` — jeho sazby a marže z nastavení.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const profile: CraftsmanProfile = { ...DEFAULT_PROFILE, ...(body.profile ?? {}) };

    const extraction = body.job
      ? { job: body.job, followUps: [], summary: String(body.summary ?? "") }
      : await extractJob(String(body.transcript ?? ""));

    const takeoff = computeTakeoff(extraction.job);
    const tiers = buildTiers(extraction.job, profile, takeoff.product);

    return NextResponse.json({ ...extraction, tiers, product: takeoff.product });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba";
    console.error("[quote]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
