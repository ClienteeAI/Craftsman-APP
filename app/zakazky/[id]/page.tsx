"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { deleteJob, getJob, STATUS, updateJob, type Job, type JobStatus } from "@/lib/crm/jobs";
import MarketingSection from "./marketing-section";

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
          className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3.5 text-base font-medium text-white active:opacity-80"
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

        {/* Kontakt + akce. */}
        <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
          <Row label="Obec" value={job.customer.obec} />
          <Row label="Telefón" value={job.customer.phone} />
          <Row label="E-mail" value={job.customer.email} />
          <div className="mt-4 flex flex-wrap gap-2">
            {job.customer.phone && (
              <a
                href={`tel:${job.customer.phone}`}
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white active:opacity-80"
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
            {job.shareUrl && (
              <a
                href={job.shareUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium active:bg-neutral-100"
              >
                Ponuka
              </a>
            )}
          </div>
        </section>

        {/* Připomenutí. */}
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Pripomenúť zavolať
          </h2>
          <input
            type="date"
            value={job.remindAt ? job.remindAt.slice(0, 10) : ""}
            onChange={(e) => patch({ remindAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-neutral-900"
          />
        </section>

        {/* Auto-marketing — nejsilnější u hotové zakázky, ale dostupné vždy. */}
        <MarketingSection job={job} />

        {/* Poznámka. */}
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Poznámka</h2>
          <textarea
            value={job.note ?? ""}
            onChange={(e) => patch({ note: e.target.value || null })}
            rows={3}
            placeholder="Čo si treba pamätať…"
            className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-neutral-900"
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

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between border-b border-neutral-100 py-2 text-[15px] last:border-0">
      <span className="text-neutral-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}
