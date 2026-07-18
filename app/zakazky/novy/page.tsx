"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createJob } from "@/lib/crm/jobs";

/**
 * Ruční založení kontaktu.
 *
 * Nejčastější scénář: majstrovi přijde poptávka mailem nebo mu někdo zavolá a
 * on si člověka potřebuje hodit do seznamu HNED, ještě než dělá nabídku. Bez
 * tohohle šel kontakt do CRM jen skrz celý quote flow — a to je moc kroků na
 * "zapiš si tohohle člověka, zavolám mu večer".
 *
 * Nic není povinné kromě aspoň jednoho vodítka (meno nebo telefon), ať se
 * nezaloží prázdná karta. Zbytek se dá doplnit v detailu.
 */
export default function NovyKontakt() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [obec, setObec] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const canSave = name.trim() !== "" || phone.trim() !== "";

  function save() {
    if (!canSave) return;
    const job = createJob({
      customer: {
        name: name.trim() || null,
        obec: obec.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      },
      note: note.trim() || null,
    });
    router.push(`/zakazky/${job.id}`);
  }

  return (
    <main className="min-h-screen text-neutral-900">
      <div className="mx-auto max-w-2xl px-5 py-8 pb-28">
        <Link href="/zakazky" className="text-sm text-neutral-500 underline underline-offset-4">
          ← Späť na zákazky
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Nový kontakt</h1>
        <p className="mt-1 text-neutral-500">
          Zapíš si zákazníka do zoznamu. Ponuku môžeš dorobiť neskôr.
        </p>

        <section className="mt-6 space-y-4 rounded-2xl border border-neutral-200/70 bg-card shadow-soft p-5">
          <Field label="Meno">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="name"
              placeholder="Ján Novák"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
            />
          </Field>
          <Field label="Obec">
            <input
              value={obec}
              onChange={(e) => setObec(e.target.value)}
              placeholder="Trnava"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
            />
          </Field>
          <Field label="Telefón">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0901 234 567"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
            />
          </Field>
          <Field label="E-mail">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              placeholder="jan@email.sk"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
            />
          </Field>
          <Field label="Poznámka">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Z čoho poptávka, čo chce, kedy volať…"
              className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
            />
          </Field>
        </section>

        {!canSave && (
          <p className="mt-3 text-center text-sm text-neutral-400">
            Vyplň aspoň meno alebo telefón.
          </p>
        )}
      </div>

      {/* Uložit pod palcem. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <button
          onClick={save}
          disabled={!canSave}
          className="mx-auto block w-full max-w-2xl rounded-xl bg-brand-600 py-3.5 text-center text-base font-medium text-white active:opacity-80 disabled:opacity-30"
        >
          Uložiť kontakt
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}
