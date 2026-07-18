import { NextRequest, NextResponse } from "next/server";
import { crmSyncEnabled, listJobsServer, upsertJobServer } from "@/lib/crm/jobs-server";
import type { Job } from "@/lib/crm/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Obnova: všechny zálohované zakázky (pro nové/vyměněné zařízení). */
export async function GET() {
  if (!crmSyncEnabled()) {
    return NextResponse.json({ synced: false, jobs: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const jobs = await listJobsServer();
    return NextResponse.json({ synced: true, jobs }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[jobs GET]", err);
    return NextResponse.json({ error: "Načítanie zlyhalo." }, { status: 500 });
  }
}

/** Záloha jedné zakázky (upsert). Volá se fire-and-forget z klienta. */
export async function POST(req: NextRequest) {
  if (!crmSyncEnabled()) return NextResponse.json({ synced: false });
  try {
    const job = (await req.json()) as Job;
    if (!job?.id) return NextResponse.json({ error: "Chýba id." }, { status: 400 });
    await upsertJobServer(job);
    return NextResponse.json({ synced: true });
  } catch (err) {
    console.error("[jobs POST]", err);
    return NextResponse.json({ error: "Záloha zlyhala." }, { status: 500 });
  }
}
