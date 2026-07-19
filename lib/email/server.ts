import { getSupabase } from "@/lib/supabase";
import { decryptSecret, emailCryptoReady, encryptSecret } from "./crypto";
import { testImap, type ImapConn } from "./imap";
import { testSmtp, type SmtpConn } from "./smtp";
import type { EmailAccount, EmailAccountInput } from "./types";

/**
 * Serverová správa pripojenej schránky. Beží cez service-role (obchádza RLS);
 * heslo sa ukladá šifrovane a von sa nikdy neposiela.
 */

export function emailEnabled(): boolean {
  return getSupabase() !== null && emailCryptoReady();
}

function rowToAccount(r: Record<string, unknown>): EmailAccount {
  return {
    email: r.email as string,
    imapHost: r.imap_host as string,
    imapPort: r.imap_port as number,
    imapSecure: r.imap_secure as boolean,
    smtpHost: r.smtp_host as string,
    smtpPort: r.smtp_port as number,
    smtpSecure: r.smtp_secure as boolean,
    username: r.username as string,
  };
}

/** Nastavenie pripojenej schránky (bez hesla), alebo null keď nič nepripojené. */
export async function getAccount(userId: string): Promise<EmailAccount | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db.from("email_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Načítanie schránky zlyhalo: ${error.message}`);
  return data ? rowToAccount(data) : null;
}

/** Spojenia (s dešifrovaným heslom) pre IMAP/SMTP operácie. Interné. */
async function loadConn(userId: string): Promise<{ imap: ImapConn; smtp: SmtpConn } | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db.from("email_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Načítanie schránky zlyhalo: ${error.message}`);
  if (!data) return null;
  const pass = decryptSecret(data.password_enc as string);
  return {
    imap: {
      host: data.imap_host as string,
      port: data.imap_port as number,
      secure: data.imap_secure as boolean,
      user: data.username as string,
      pass,
    },
    smtp: {
      host: data.smtp_host as string,
      port: data.smtp_port as number,
      secure: data.smtp_secure as boolean,
      user: data.username as string,
      pass,
      from: data.email as string,
    },
  };
}

/** Zveřejní IMAP spojení pro čítacie operácie (list/get/delete). */
export async function imapConn(userId: string): Promise<ImapConn | null> {
  return (await loadConn(userId))?.imap ?? null;
}

/** Zveřejní SMTP spojení pro odosielanie. */
export async function smtpConn(userId: string): Promise<SmtpConn | null> {
  return (await loadConn(userId))?.smtp ?? null;
}

/**
 * Pripojí (alebo aktualizuje) schránku. Najprv OVERÍ IMAP aj SMTP prihlásenie —
 * keď zlyhá, nič neuloží a vráti zrozumný dôvod. Až potom heslo zašifruje a uloží.
 */
export async function saveAccount(userId: string, orgId: string | null, input: EmailAccountInput): Promise<EmailAccount> {
  const db = getSupabase();
  if (!db) throw new Error("Supabase nie je nakonfigurované.");
  if (!emailCryptoReady()) throw new Error("Chýba EMAIL_ENC_KEY — bez neho sa heslo nedá bezpečne uložiť.");

  const imap: ImapConn = {
    host: input.imapHost.trim(),
    port: input.imapPort,
    secure: input.imapSecure,
    user: input.username.trim(),
    pass: input.password,
  };
  const smtp: SmtpConn = {
    host: input.smtpHost.trim(),
    port: input.smtpPort,
    secure: input.smtpSecure,
    user: input.username.trim(),
    pass: input.password,
    from: input.email.trim(),
  };

  // Test spojenia — zrozumiteľná chyba pre majstra.
  try {
    await testImap(imap);
  } catch (e) {
    throw new Error(`IMAP (čítanie) sa nepodarilo pripojiť: ${e instanceof Error ? e.message : "neznáma chyba"}`);
  }
  try {
    await testSmtp(smtp);
  } catch (e) {
    throw new Error(`SMTP (odosielanie) sa nepodarilo pripojiť: ${e instanceof Error ? e.message : "neznáma chyba"}`);
  }

  const { error } = await db.from("email_accounts").upsert({
    user_id: userId,
    org_id: orgId,
    email: input.email.trim(),
    imap_host: imap.host,
    imap_port: imap.port,
    imap_secure: imap.secure,
    smtp_host: smtp.host,
    smtp_port: smtp.port,
    smtp_secure: smtp.secure,
    username: imap.user,
    password_enc: encryptSecret(input.password),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Uloženie schránky zlyhalo: ${error.message}`);

  return {
    email: input.email.trim(),
    imapHost: imap.host,
    imapPort: imap.port,
    imapSecure: imap.secure,
    smtpHost: smtp.host,
    smtpPort: smtp.port,
    smtpSecure: smtp.secure,
    username: imap.user,
  };
}

export async function deleteAccount(userId: string): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db.from("email_accounts").delete().eq("user_id", userId);
  if (error) throw new Error(`Odpojenie schránky zlyhalo: ${error.message}`);
}
