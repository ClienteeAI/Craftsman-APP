import { NextResponse } from "next/server";
import { crmSyncEnabled, deleteJobServer } from "@/lib/crm/jobs-server";
import { currentUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
