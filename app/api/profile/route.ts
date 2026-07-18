import { NextRequest, NextResponse } from "next/server";
import { getProfileServer, profileSyncEnabled, upsertProfileServer } from "@/lib/quote/profile-server";
import { currentUserId } from "@/lib/supabase/server";
import type { CraftsmanProfile } from "@/lib/quote/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Obnova profilu přihlášeného řemeslníka. */
export async function GET() {
  if (!profileSyncEnabled()) {
    return NextResponse.json({ synced: false, profile: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ synced: false, profile: null }, { status: 401 });
  try {
    const profile = await getProfileServer(userId);
    return NextResponse.json({ synced: true, profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[profile GET]", err);
    return NextResponse.json({ error: "Načítanie zlyhalo." }, { status: 500 });
  }
}

/** Záloha profilu (upsert) pod přihlášeného řemeslníka. */
export async function POST(req: NextRequest) {
  if (!profileSyncEnabled()) return NextResponse.json({ synced: false });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ synced: false }, { status: 401 });
  try {
    const profile = (await req.json()) as CraftsmanProfile;
    await upsertProfileServer(profile, userId);
    return NextResponse.json({ synced: true });
  } catch (err) {
    console.error("[profile POST]", err);
    return NextResponse.json({ error: "Záloha zlyhala." }, { status: 500 });
  }
}
