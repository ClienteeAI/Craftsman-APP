"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { EmailAccount, EmailAccountInput, MailDetail, MailSummary } from "@/lib/email/types";

/**
 * Pošta — vlastná schránka majstra (IMAP čítanie + SMTP odosielanie).
 *
 * Majster si pripojí svoj mailserver (adresa + prístupy). Appka potom vie
 * čítať, písať aj mazať. Heslo drží server šifrovane; sem sa nikdy nevracia.
 */

type Form = EmailAccountInput;

const EMPTY: Form = {
  email: "",
  imapHost: "",
  imapPort: 993,
  imapSecure: true,
  smtpHost: "",
  smtpPort: 465,
  smtpSecure: true,
  username: "",
  password: "",
};

/** Predvoľby serverov, ať majster nehľadá porty. */
const PRESETS: { name: string; note?: string; v: Partial<Form> }[] = [
  { name: "Gmail", note: "vyžaduje App password (2FA)", v: { imapHost: "imap.gmail.com", imapPort: 993, imapSecure: true, smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true } },
  { name: "Seznam.cz", v: { imapHost: "imap.seznam.cz", imapPort: 993, imapSecure: true, smtpHost: "smtp.seznam.cz", smtpPort: 465, smtpSecure: true } },
  { name: "Outlook", note: "SMTP cez STARTTLS 587", v: { imapHost: "outlook.office365.com", imapPort: 993, imapSecure: true, smtpHost: "smtp.office365.com", smtpPort: 587, smtpSecure: false } },
];

export default function Posta() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<EmailAccount | null>(null);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email/account", { cache: "no-store" });
      const b = await res.json();
      if (!b.enabled) {
        setEnabled(false);
        return;
      }
      setAccount(b.account ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <header className="flex items-center gap-3">
          <Link href="/prehlad" className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900">
            ← Prehľad
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Pošta</h1>
        </header>

        {loading ? (
          <p className="mt-8 text-sm text-neutral-400">Načítavam…</p>
        ) : !enabled ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
            Schránka potrebuje cloud (Supabase) a šifrovací kľúč <code>EMAIL_ENC_KEY</code> v prostredí —
            heslo k mailu sa ukladá šifrovane. Doplň ich a stránka ožije.
          </div>
        ) : account ? (
          <Mailbox account={account} onDisconnect={loadAccount} />
        ) : (
          <ConnectForm onConnected={loadAccount} />
        )}
      </div>
    </main>
  );
}

/* ─────────────────────────── Pripojenie schránky ─────────────────────────── */

function ConnectForm({ onConnected }: { onConnected: () => void }) {
  const [f, setF] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function connect() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/email/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, username: f.username || f.email }),
      });
      const b = await res.json();
      if (b.error) {
        setErr(b.error);
        return;
      }
      onConnected();
    } catch {
      setErr("Pripojenie zlyhalo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
      <section className="rounded-2xl border border-neutral-200/70 bg-card p-6 shadow-soft">
        <h2 className="text-sm font-semibold">Pripojiť vlastnú schránku</h2>
        <p className="mt-1 text-xs text-neutral-500">Adresu a prístupy si zadávaš sám. Appka spojenie najprv otestuje.</p>

        {/* Predvoľby */}
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => setF((prev) => ({ ...prev, ...p.v }))}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium transition hover:border-brand-300 hover:bg-brand-50"
              title={p.note}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <Labeled label="E-mailová adresa">
            <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="ja@mojadomena.sk" className={inputCls} />
          </Labeled>
          <Labeled label="Používateľ (obvykle rovnaký ako e-mail)">
            <input value={f.username} onChange={(e) => set("username", e.target.value)} placeholder={f.email || "prihlasovacie meno"} className={inputCls} />
          </Labeled>
          <Labeled label="Heslo (alebo App password)">
            <input type="password" value={f.password} onChange={(e) => set("password", e.target.value)} className={inputCls} />
          </Labeled>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 bg-white/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">IMAP — čítanie</p>
              <input value={f.imapHost} onChange={(e) => set("imapHost", e.target.value)} placeholder="imap.server.sk" className={inputCls} />
              <div className="mt-2 flex items-center gap-2">
                <input inputMode="numeric" value={f.imapPort} onChange={(e) => set("imapPort", Number(e.target.value) || 0)} className={`${inputCls} w-24`} />
                <label className="flex items-center gap-1.5 text-sm text-neutral-600">
                  <input type="checkbox" checked={f.imapSecure} onChange={(e) => set("imapSecure", e.target.checked)} /> SSL
                </label>
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">SMTP — odosielanie</p>
              <input value={f.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} placeholder="smtp.server.sk" className={inputCls} />
              <div className="mt-2 flex items-center gap-2">
                <input inputMode="numeric" value={f.smtpPort} onChange={(e) => set("smtpPort", Number(e.target.value) || 0)} className={`${inputCls} w-24`} />
                <label className="flex items-center gap-1.5 text-sm text-neutral-600">
                  <input type="checkbox" checked={f.smtpSecure} onChange={(e) => set("smtpSecure", e.target.checked)} /> SSL
                </label>
              </div>
            </div>
          </div>

          {err && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-600">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              Beriem na vedomie, že heslo je síce šifrované, ale za bezpečnosť schránky sa neručí —
              pripájam ju na <strong>vlastnú zodpovednosť</strong>.
            </span>
          </label>

          <button
            onClick={connect}
            disabled={busy || !ack}
            className="w-full rounded-xl bg-brand-600 py-3 text-base font-medium text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-40"
          >
            {busy ? "Overujem spojenie…" : "Pripojiť schránku"}
          </button>
        </div>
      </section>

      <aside className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
        <p className="font-semibold">Než pripojíš:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[13px]">
          <li>Heslo sa ukladá <strong>šifrovane</strong> a späť sa nikdy nezobrazí.</li>
          <li><strong>Gmail/Outlook</strong> nepustia bežné heslo — vygeneruj si „App password" (Gmail: účet s 2FA → App passwords).</li>
          <li>Vlastná doménová schránka funguje s bežným menom a heslom.</li>
          <li>Appka číta a maže priamo v tvojej schránke — je to tvoja pošta.</li>
        </ul>
        <p className="mt-3 border-t border-amber-200 pt-3 text-[13px] font-medium">
          Aj keď heslo šifrujeme, za bezpečnosť tvojej e-mailovej schránky <strong>neručíme</strong>.
          Schránku pripájaš na <strong>vlastnú zodpovednosť</strong>.
        </p>
      </aside>
    </div>
  );
}

/* ──────────────────────────────── Schránka ───────────────────────────────── */

function Mailbox({ account, onDisconnect }: { account: EmailAccount; onDisconnect: () => void }) {
  const [list, setList] = useState<MailSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openUid, setOpenUid] = useState<number | null>(null);
  const [compose, setCompose] = useState(false);

  const refresh = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/email/messages", { cache: "no-store" });
      const b = await res.json();
      if (b.error) {
        setErr(b.error);
        return;
      }
      setList(b.messages ?? []);
    } catch {
      setErr("Načítanie pošty zlyhalo.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function disconnect() {
    if (!confirm("Odpojiť schránku? Heslo sa zmaže, poštu už nebudeme čítať.")) return;
    await fetch("/api/email/account", { method: "DELETE" });
    onDisconnect();
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{account.email}</span>
          <button onClick={disconnect} className="ml-3 text-neutral-400 underline underline-offset-4 hover:text-red-600">
            Odpojiť
          </button>
        </div>
        <button
          onClick={() => setCompose(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
        >
          ✎ Napísať
        </button>
      </div>

      {err && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr] lg:items-start">
        {/* Zoznam */}
        <section className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-card shadow-soft">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold">Doručené</h2>
            <button onClick={refresh} className="text-xs font-medium text-brand-700 hover:underline">
              Obnoviť
            </button>
          </div>
          {list === null ? (
            <p className="p-6 text-sm text-neutral-400">Načítavam…</p>
          ) : list.length === 0 ? (
            <p className="p-6 text-sm text-neutral-400">Schránka je prázdna.</p>
          ) : (
            <div className="max-h-[70vh] divide-y divide-neutral-100 overflow-y-auto">
              {list.map((m) => (
                <button
                  key={m.uid}
                  onClick={() => setOpenUid(m.uid)}
                  className={`block w-full px-4 py-3 text-left transition hover:bg-neutral-50 ${
                    openUid === m.uid ? "bg-brand-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`min-w-0 truncate text-sm ${m.seen ? "text-neutral-600" : "font-semibold"}`}>
                      {m.fromName || m.from || "—"}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-400">
                      {m.date ? new Date(m.date).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" }) : ""}
                    </span>
                  </div>
                  <p className={`mt-0.5 truncate text-sm ${m.seen ? "text-neutral-500" : "text-neutral-800"}`}>{m.subject}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Čítanie */}
        <section className="min-h-[50vh] rounded-2xl border border-neutral-200/70 bg-card p-5 shadow-soft">
          {openUid ? (
            <MailView uid={openUid} onDeleted={() => { setOpenUid(null); refresh(); }} />
          ) : (
            <p className="grid h-full place-items-center text-sm text-neutral-400">Vyber e-mail zo zoznamu.</p>
          )}
        </section>
      </div>

      {compose && <Compose defaultFrom={account.email} onClose={() => setCompose(false)} />}
    </>
  );
}

function MailView({ uid, onDeleted }: { uid: number; onDeleted: () => void }) {
  const [msg, setMsg] = useState<MailDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMsg(null);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(`/api/email/message?uid=${uid}`, { cache: "no-store" });
        const b = await res.json();
        if (b.error) setErr(b.error);
        else setMsg(b.message);
      } catch {
        setErr("Načítanie e-mailu zlyhalo.");
      }
    })();
  }, [uid]);

  async function del() {
    if (!confirm("Zmazať tento e-mail?")) return;
    await fetch(`/api/email/message?uid=${uid}`, { method: "DELETE" });
    onDeleted();
  }

  if (err) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>;
  if (!msg) return <p className="text-sm text-neutral-400">Načítavam…</p>;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{msg.subject}</h2>
          <p className="mt-0.5 truncate text-sm text-neutral-500">Od: {msg.from}</p>
          <p className="truncate text-xs text-neutral-400">
            {msg.date ? new Date(msg.date).toLocaleString("sk-SK") : ""}
          </p>
        </div>
        <button
          onClick={del}
          className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
        >
          Zmazať
        </button>
      </div>

      {/* HTML v sandboxovanom iframe — cudzí obsah nesmie spúšťať skripty. */}
      {msg.html ? (
        <iframe
          title="e-mail"
          sandbox=""
          srcDoc={msg.html}
          className="mt-3 h-[55vh] w-full rounded-lg border border-neutral-100 bg-white"
        />
      ) : (
        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm text-neutral-700">{msg.text ?? "(prázdny e-mail)"}</pre>
      )}

      {msg.attachments.length > 0 && (
        <p className="mt-3 text-xs text-neutral-400">
          Prílohy: {msg.attachments.map((a) => a.filename).join(", ")}
        </p>
      )}
    </div>
  );
}

function Compose({ defaultFrom, onClose }: { defaultFrom: string; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, text: body }),
      });
      const b = await res.json();
      if (b.error) {
        setErr(b.error);
        return;
      }
      setSent(true);
      setTimeout(onClose, 900);
    } catch {
      setErr("Odoslanie zlyhalo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-t-3xl bg-card p-6 shadow-lift sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nový e-mail</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-neutral-400 hover:bg-neutral-100">✕</button>
        </div>
        <p className="mt-0.5 text-xs text-neutral-400">Z: {defaultFrom}</p>

        <div className="mt-4 space-y-3">
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Komu (e-mail)" className={inputCls} />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Predmet" className={inputCls} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Text…" className={`${inputCls} resize-none`} />
          {err && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</p>}
          <button
            onClick={send}
            disabled={busy || sent || !to || !subject}
            className="w-full rounded-xl bg-brand-600 py-3 text-base font-medium text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-40"
          >
            {sent ? "Odoslané ✓" : busy ? "Posielam…" : "Odoslať"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-base shadow-soft outline-none transition hover:border-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
