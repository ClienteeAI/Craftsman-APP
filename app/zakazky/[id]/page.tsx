"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { deleteJob, getJob, STATUS, updateJob, type Job, type JobStatus } from "@/lib/crm/jobs";
import MarketingSection from "./marketing-section";
import JobOffer from "./job-offer";
import DetailsForm from "./details-form";

/**
 * Karta zákazníka — detail zakázky.
 *
 * Ze zadání: zavolať, navigácia, zmeniť stav, pripomenutie na konkrétny deň.
 * Tady majster zakázku vede: přepne stav, když pošle nabídku nebo domluví
 * realizaci, a nastaví si, kdy zavolat.
 */
export default function ZakazkaDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const j = getJob(id);
    if (j) setJob(j);
    else setNotFound(true);
  }, [id]);

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-center">
          <p className="text-neutral-400">Zákazka sa nenašla.</p>
          <Link href="/zakazky" className="mt-4 inline-block text-sm underline underline-offset-4">
            Späť na zákazky
          </Link>
        </div>
      </main>
    );
  }

  if (!job) return null;

  function patch(p: Partial<Job>) {
    const updated = updateJob(id, p);
    if (updated) setJob({ ...updated });
  }

  function setCustomerField(field: keyof Job["customer"], value: string) {
    if (!job) return;
    patch({ customer: { ...job.customer, [field]: value.trim() || null } });
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-2xl px-5 py-8 pb-28">
        <Link href="/zakazky" className="text-sm text-neutral-500 underline underline-offset-4">
          ← Späť na zákazky
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{job.customer.name ?? "Bez mena"}</h1>
        <p className="mt-1 text-neutral-500">{job.summary}</p>

        {/* Nabídka pro TENHLE kontakt. Otevře quote flow předvyplněný zákazníkem —
            majster tam prilepí mail (text i fotky) a appka vytáhne zbytek. Po
            odeslání se nabídka přilepí zpátky na tuhle kartu. */}
        <Link
          href={`/?zakazka=${job.id}`}
          className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-base font-medium text-white shadow-soft transition hover:bg-brand-700 active:opacity-90"
        >
          {job.shareUrl ? "Nová ponuka pre kontakt" : "Vytvoriť ponuku"}
        </Link>

        {/* Stav — přepínač. Toto je jádro CRM: kde v procesu zakázka je. */}
        <section className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Stav</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS) as JobStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => patch({ status: s })}
                className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium ${
                  job.status === s
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white active:bg-neutral-100"
                }`}
              >
                {STATUS[s].dot} {STATUS[s].label}
              </button>
            ))}
          </div>
        </section>

        {/* Kontakt — editovatelný. Doplníš meno, telefón, mail aj u zákazky,
            ktorá prišla bez nich (napr. z mailu bez podpisu). */}
        <section className="mt-8 rounded-2xl border border-neutral-200/70 bg-white shadow-soft p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Kontakt
          </h2>
          <div className="space-y-3">
            <Field
              label="Meno a priezvisko"
              value={job.customer.name}
              placeholder="Ján Novák"
              onCommit={(v) => setCustomerField("name", v)}
            />
            <Field
              label="Obec"
              value={job.customer.obec}
              placeholder="Bratislava"
              onCommit={(v) => setCustomerField("obec", v)}
            />
            <Field
              label="Telefón"
              type="tel"
              value={job.customer.phone}
              placeholder="0901 234 567"
              onCommit={(v) => setCustomerField("phone", v)}
            />
            <Field
              label="E-mail"
              type="email"
              value={job.customer.email}
              placeholder="jan@email.sk"
              onCommit={(v) => setCustomerField("email", v)}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {job.customer.phone && (
              <a
                href={`tel:${job.customer.phone}`}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
              >
                Zavolať
              </a>
            )}
            {job.customer.obec && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.customer.obec)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium active:bg-neutral-100"
              >
                Navigovať
              </a>
            )}
          </div>
        </section>

        {/* Odoslaná ponuka — cena, odkaz na to, co vidí zákazník, a živý stav. */}
        {job.shareUrl ? (
          <JobOffer shareUrl={job.shareUrl} priceExVat={job.priceExVat} />
        ) : (
          <section className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-5 text-center">
            <p className="text-sm font-medium text-neutral-600">Táto zákazka zatiaľ nemá ponuku.</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Nemusíš nič robiť odznova — ťukni hore na „Vytvoriť ponuku". Po odoslaní sa sem
              pripojí cena aj živý stav (otvoril / má záujem / podpísal).
            </p>
          </section>
        )}

        {/* Obsáhlé parametry zakázky — fakturace, technická střecha, prostupy… */}
        <DetailsForm details={job.details} onChange={(details) => patch({ details })} />

        {/* Termín realizace — kdy začneme pracovat (jiné než připomenutí zavolat). */}
        <section className="mt-6 rounded-2xl border border-neutral-200/70 bg-white shadow-soft p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Termín realizácie
          </h2>
          <p className="-mt-1 mb-2 text-xs text-neutral-400">Kedy na zákazke začneme pracovať.</p>
          <input
            type="date"
            value={job.startAt ? job.startAt.slice(0, 10) : ""}
            onChange={(e) => patch({ startAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
          />
        </section>

        {/* Připomenutí. */}
        <section className="mt-6 rounded-2xl border border-neutral-200/70 bg-white shadow-soft p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Pripomenúť zavolať
          </h2>
          <input
            type="date"
            value={job.remindAt ? job.remindAt.slice(0, 10) : ""}
            onChange={(e) => patch({ remindAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
          />
        </section>

        {/* Auto-marketing — nejsilnější u hotové zakázky, ale dostupné vždy. */}
        <MarketingSection job={job} />

        {/* Poznámka. */}
        <section className="mt-6 rounded-2xl border border-neutral-200/70 bg-white shadow-soft p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Poznámka</h2>
          <textarea
            value={job.note ?? ""}
            onChange={(e) => patch({ note: e.target.value || null })}
            rows={3}
            placeholder="Čo si treba pamätať…"
            className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
          />
        </section>

        <button
          onClick={() => {
            if (confirm("Zmazať zákazku?")) {
              deleteJob(id);
              router.push("/zakazky");
            }
          }}
          className="mt-8 text-sm text-red-600 underline underline-offset-4"
        >
          Zmazať zákazku
        </button>
      </div>
    </main>
  );
}

/**
 * Editovatelné pole kontaktu. Commit na blur (ne po každém písmenu) — ať se
 * localStorage i cloudová záloha nespouští při každém stisku klávesy.
 */
function Field({
  label,
  value,
  onCommit,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | null;
  onCommit: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-400">{label}</span>
      <input
        type={type}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if ((value ?? "") !== v) onCommit(v);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
      />
    </label>
  );
}
