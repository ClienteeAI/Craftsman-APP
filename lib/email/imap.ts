import { ImapFlow } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import type { MailDetail, MailSummary } from "./types";

/**
 * Čítanie a mazanie e-mailov cez IMAP (imapflow).
 *
 * Každá operácia je vlastné krátke spojenie (connect → práca → logout).
 * Na serverless (Vercel) to je správne — funkcia žije krátko, nedržíme
 * dlhé IMAP spojenie. Trochu pomalšie, zato spoľahlivé a bez leakov.
 */

export type ImapConn = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

function client(c: ImapConn): ImapFlow {
  return new ImapFlow({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
    logger: false,
  });
}

function addrText(a: AddressObject | AddressObject[] | undefined): string {
  if (!a) return "";
  return Array.isArray(a) ? a.map((x) => x.text).join(", ") : a.text;
}

/** Overí, že sa dá prihlásiť. Vyhodí chybu s dôvodom, keď nie. */
export async function testImap(c: ImapConn): Promise<void> {
  const cl = client(c);
  await cl.connect();
  await cl.logout().catch(() => {});
}

/** Posledných `limit` správ z INBOXu, najnovšie hore. */
export async function listMessages(c: ImapConn, limit = 30): Promise<MailSummary[]> {
  const cl = client(c);
  await cl.connect();
  try {
    const lock = await cl.getMailboxLock("INBOX");
    try {
      const mbox = cl.mailbox;
      const total = typeof mbox === "object" ? mbox.exists : 0;
      if (!total) return [];
      const start = Math.max(1, total - limit + 1);
      const out: MailSummary[] = [];
      for await (const m of cl.fetch(`${start}:*`, { envelope: true, flags: true, uid: true })) {
        const from = m.envelope?.from?.[0];
        out.push({
          uid: m.uid,
          from: from?.address ?? "",
          fromName: from?.name ?? null,
          subject: m.envelope?.subject || "(bez predmetu)",
          date: m.envelope?.date ? new Date(m.envelope.date).toISOString() : null,
          seen: m.flags?.has("\\Seen") ?? false,
        });
      }
      out.reverse();
      return out;
    } finally {
      lock.release();
    }
  } finally {
    await cl.logout().catch(() => {});
  }
}

/** Jeden e-mail celý (telo + prílohy). Zároveň ho označí ako prečítaný. */
export async function getMessage(c: ImapConn, uid: number): Promise<MailDetail | null> {
  const cl = client(c);
  await cl.connect();
  try {
    const lock = await cl.getMailboxLock("INBOX");
    try {
      const msg = await cl.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) return null;
      const parsed = await simpleParser(msg.source);
      await cl.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }).catch(() => {});
      return {
        uid,
        from: parsed.from?.text ?? "",
        to: addrText(parsed.to),
        subject: parsed.subject || "(bez predmetu)",
        date: parsed.date ? parsed.date.toISOString() : null,
        html: typeof parsed.html === "string" ? parsed.html : null,
        text: parsed.text ?? null,
        attachments: (parsed.attachments ?? []).map((a) => ({
          filename: a.filename ?? "príloha",
          size: a.size ?? 0,
        })),
      };
    } finally {
      lock.release();
    }
  } finally {
    await cl.logout().catch(() => {});
  }
}

/** Zmaže e-mail (presun do koša / expunge podľa servera). */
export async function deleteMessage(c: ImapConn, uid: number): Promise<void> {
  const cl = client(c);
  await cl.connect();
  try {
    const lock = await cl.getMailboxLock("INBOX");
    try {
      await cl.messageDelete(String(uid), { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await cl.logout().catch(() => {});
  }
}
