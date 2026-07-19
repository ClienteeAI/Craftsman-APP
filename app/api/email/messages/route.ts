import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/supabase/server";
import { emailEnabled, imapConn } from "@/lib/email/server";
import { listMessages } from "@/lib/email/imap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Zoznam posledných e-mailov z INBOXu. */
export async function GET() {
  if (!emailEnabled()) return NextResponse.json({ enabled: false, messages: [] });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  try {
    const conn = await imapConn(userId);
    if (!conn) return NextResponse.json({ connected: false, messages: [] });
    const messages = await listMessages(conn, 30);
    return NextResponse.json({ connected: true, messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Načítanie pošty zlyhalo.";
    console.error("[email messages]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
