import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/supabase/server";
import { emailEnabled, smtpConn } from "@/lib/email/server";
import { sendMail } from "@/lib/email/smtp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Odoslať e-mail z pripojenej schránky majstra. */
export async function POST(req: NextRequest) {
  if (!emailEnabled()) return NextResponse.json({ error: "Schránka nie je dostupná." }, { status: 400 });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  try {
    const { to, subject, html, text } = (await req.json()) as {
      to: string;
      subject: string;
      html?: string;
      text?: string;
    };
    if (!to || !subject || (!html && !text)) {
      return NextResponse.json({ error: "Vyplň príjemcu, predmet a text." }, { status: 400 });
    }
    const conn = await smtpConn(userId);
    if (!conn) return NextResponse.json({ error: "Schránka nie je pripojená." }, { status: 400 });
    await sendMail(conn, { to, subject, html, text });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Odoslanie zlyhalo.";
    console.error("[email send]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
