import { NextResponse } from "next/server";
import { crmSyncEnabled, deleteJobServer, getVisibleJobServer } from "@/lib/crm/jobs-server";
import { currentUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Jedna zakázka zo servera, keď ju používateľ smie vidieť podľa role. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!crmSyncEnabled()) return NextResponse.json({ synced: false, job: null });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ synced: false, job: null }, { status: 401 });
  try {
    const { id } = await params;
    const job = await getVisibleJobServer(id, userId);
    return NextResponse.json({ synced: true, job }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[jobs GET one]", err);
    return NextResponse.json({ error: "Načítanie zlyhalo." }, { status: 500 });
  }
}

/** Smaže zálohu zakázky (jen vlastní), ať se po obnově na jiném zařízení nevrátí. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!crmSyncEnabled()) return NextResponse.json({ synced: false });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ synced: false }, { status: 401 });
  try {
    const { id } = await params;
    await deleteJobServer(id, userId);
    return NextResponse.json({ synced: true });
  } catch (err) {
    console.error("[jobs DELETE]", err);
    return NextResponse.json({ error: "Zmazanie zlyhalo." }, { status: 500 });
  }
}
