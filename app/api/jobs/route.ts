import { NextRequest, NextResponse } from "next/server";
import { crmSyncEnabled, listJobsServer, upsertJobServer } from "@/lib/crm/jobs-server";
import { currentUserId } from "@/lib/supabase/server";
import type { Job } from "@/lib/crm/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Obnova: všechny zálohované zakázky přihlášeného řemeslníka. */
export async function GET() {
  if (!crmSyncEnabled()) {
    return NextResponse.json({ synced: false, jobs: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ synced: false, jobs: [] }, { status: 401 });
  try {
    const jobs = await listJobsServer(userId);
    return NextResponse.json({ synced: true, jobs }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[jobs GET]", err);
    return NextResponse.json({ error: "Načítanie zlyhalo." }, { status: 500 });
  }
}

/** Záloha jedné zakázky (upsert) pod přihlášeného řemeslníka. */
export async function POST(req: NextRequest) {
  if (!crmSyncEnabled()) return NextResponse.json({ synced: false });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ synced: false }, { status: 401 });
  try {
    const job = (await req.json()) as Job;
    if (!job?.id) return NextResponse.json({ error: "Chýba id." }, { status: 400 });
    await upsertJobServer(job, userId);
    return NextResponse.json({ synced: true });
  } catch (err) {
    console.error("[jobs POST]", err);
    return NextResponse.json({ error: "Záloha zlyhala." }, { status: 500 });
  }
}
