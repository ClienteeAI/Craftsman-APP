import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/supabase/server";
import { deleteAccount, emailEnabled, getAccount, saveAccount } from "@/lib/email/server";
import { ensureOrgContext } from "@/lib/org/server";
import type { EmailAccountInput } from "@/lib/email/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nastavenie pripojenej schránky (bez hesla). */
export async function GET() {
  if (!emailEnabled()) return NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ enabled: false }, { status: 401 });
  try {
    const account = await getAccount(userId);
    return NextResponse.json({ enabled: true, account }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[email account GET]", err);
    return NextResponse.json({ error: "Načítanie schránky zlyhalo." }, { status: 500 });
  }
}

/** Pripojiť/aktualizovať schránku (otestuje spojenie, zašifruje heslo). */
export async function POST(req: NextRequest) {
  if (!emailEnabled())
    return NextResponse.json({ error: "Schránka vyžaduje Supabase a EMAIL_ENC_KEY." }, { status: 400 });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  try {
    const input = (await req.json()) as EmailAccountInput;
    if (!input.email || !input.imapHost || !input.smtpHost || !input.username || !input.password) {
      return NextResponse.json({ error: "Vyplň e-mail, servery, používateľa a heslo." }, { status: 400 });
    }
    const org = await ensureOrgContext(userId).catch(() => null);
    const account = await saveAccount(userId, org?.org.id ?? null, input);
    return NextResponse.json({ enabled: true, account });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Pripojenie zlyhalo.";
    console.error("[email account POST]", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** Odpojiť schránku. */
export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  try {
    await deleteAccount(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[email account DELETE]", err);
    return NextResponse.json({ error: "Odpojenie zlyhalo." }, { status: 500 });
  }
}
