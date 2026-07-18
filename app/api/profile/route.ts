import { NextRequest, NextResponse } from "next/server";
import { getProfileServer, profileSyncEnabled, upsertProfileServer } from "@/lib/quote/profile-server";
import type { CraftsmanProfile } from "@/lib/quote/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Obnova profilu ze zálohy (nové/vyměněné zařízení). */
export async function GET() {
  if (!profileSyncEnabled()) {
    return NextResponse.json({ synced: false, profile: null }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const profile = await getProfileServer();
    return NextResponse.json({ synced: true, profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[profile GET]", err);
    return NextResponse.json({ error: "Načítanie zlyhalo." }, { status: 500 });
  }
}

/** Záloha profilu (upsert). Fire-and-forget z klienta při uložení nastavení. */
export async function POST(req: NextRequest) {
  if (!profileSyncEnabled()) return NextResponse.json({ synced: false });
  try {
    const profile = (await req.json()) as CraftsmanProfile;
    await upsertProfileServer(profile);
    return NextResponse.json({ synced: true });
  } catch (err) {
    console.error("[profile POST]", err);
    return NextResponse.json({ error: "Záloha zlyhala." }, { status: 500 });
  }
}
