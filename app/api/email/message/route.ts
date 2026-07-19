import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/supabase/server";
import { emailEnabled, imapConn } from "@/lib/email/server";
import { deleteMessage, getMessage } from "@/lib/email/imap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Jeden e-mail celý. ?uid=123 */
export async function GET(req: NextRequest) {
  if (!emailEnabled()) return NextResponse.json({ error: "Schránka nie je dostupná." }, { status: 400 });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  const uid = Number(req.nextUrl.searchParams.get("uid"));
  if (!uid) return NextResponse.json({ error: "Chýba uid." }, { status: 400 });
  try {
    const conn = await imapConn(userId);
    if (!conn) return NextResponse.json({ error: "Schránka nie je pripojená." }, { status: 400 });
    const message = await getMessage(conn, uid);
    if (!message) return NextResponse.json({ error: "E-mail sa nenašiel." }, { status: 404 });
    return NextResponse.json({ message }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Načítanie e-mailu zlyhalo.";
    console.error("[email message GET]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** Zmazať e-mail. ?uid=123 */
export async function DELETE(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  const uid = Number(req.nextUrl.searchParams.get("uid"));
  if (!uid) return NextResponse.json({ error: "Chýba uid." }, { status: 400 });
  try {
    const conn = await imapConn(userId);
    if (!conn) return NextResponse.json({ error: "Schránka nie je pripojená." }, { status: 400 });
    await deleteMessage(conn, uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Zmazanie zlyhalo.";
    console.error("[email message DELETE]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
