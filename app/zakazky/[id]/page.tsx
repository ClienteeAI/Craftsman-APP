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
type Nudge = { title: string; body: string; actionLabel: string; actionHref: string };

const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/**
 * Chytrá výzva k akci. Přečte stav zakázky (nabídka poslaná? otevřel? zájem?)
 * a navrhne další krok, který majstrovi pomůže zakázku získat. Vrací null, když
 * není co řešit (aby popup neotravoval, když všechno běží).
 */
async function computeNudge(j: Job): Promise<Nudge | null> {
  const tel = j.customer.phone ? `tel:${j.customer.phone}` : `/?zakazka=${j.id}`;
  if (!j.shareUrl) {
    return {
      title: "Naceňte túto zákazku",
      body: "Ešte nemá ponuku. Naceňte ju a pošlite zákazníkovi, kým je v nálade — rýchla ponuka znamená viac zákaziek.",
      actionLabel: "Vytvoriť ponuku",
      actionHref: `/?zakazka=${j.id}`,
    };
  }
  const sid = j.shareUrl.split("/p/")[1];
  if (!sid) return null;
  try {
    const res = await fetch(`/api/share/${sid}`, { cache: "no-store" });
    if (!res.ok) return null;
    const s = await res.json();
    if (s.signedAt)
      return { title: "Zákazník podpísal! 🎉", body: "Ozvite sa a dohodnite termín realizácie.", actionLabel: "Zavolať", actionHref: tel };
    if (s.interestedAt || s.chosenTier)
      return { title: "Zákazník má záujem! 🔥", body: "Zavolajte mu teraz, kým je rozhodnutý — toto je tá chvíľa.", actionLabel: "Zavolať", actionHref: tel };
    if (s.openedAt && daysAgo(s.openedAt) >= 1)
      return { title: "Pozrel ponuku, ale neozval sa", body: `Pozrel ju pred ${daysAgo(s.openedAt)} dňami. Jeden telefonát to rozhýbe.`, actionLabel: "Zavolať", actionHref: tel };
    if (!s.openedAt && s.createdAt && daysAgo(s.createdAt) >= 2)
      return { title: "Ponuka ešte neotvorená", body: `Poslali ste pred ${daysAgo(s.createdAt)} dňami a zákazník ju ešte neotvoril. Skúste sa ozvať alebo poslať znova.`, actionLabel: "Zavolať", actionHref: tel };
    return null;
  } catch {
    return null;
  }
}

export default function ZakazkaDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [notFound, setNotFound] = useState(false);
  // Chytrá výzva k akci při vstupu — přečte stav zakázky a navrhne další krok,
  // co pomůže získat zakázku (naceniť / ozvať sa / zavolať).
  const [nudge, setNudge] = useState<Nudge | null>(null);

  useEffect(() => {
    const j = getJob(id);
    if (!j) {
      setNotFound(true);
      return;
    }
    setJob(j);
    void computeNudge(j).then(setNudge);
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
    <main className="min-h-screen text-neutral-900">
      {/* Chytrá výzva k akci při vstupu — pomáhá získat zakázku. */}
      {nudge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm"
          onClick={() => setNudge(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">{nudge.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">{nudge.body}</p>
            {job.note && job.note.trim() && (
              <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                📌 {job.note}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <a
                href={nudge.actionHref}
                onClick={() => setNudge(null)}
                className="flex-1 rounded-xl bg-brand-600 py-3 text-center text-base font-medium text-white shadow-soft transition hover:bg-brand-700"
              >
                {nudge.actionLabel}
              </a>
              <button
                onClick={() => setNudge(null)}
                className="rounded-xl border border-neutral-300 px-5 py-3 text-base font-medium text-neutral-500 transition hover:bg-neutral-50"
              >
                Neskôr
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <Link href="/zakaznici" className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900">
          ← Späť na zákazníkov
        </Link>

        {/* Hlavička: meno + stav vľavo, akcia vpravo. */}
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">{job.customer.name ?? "Bez mena"}</h1>
            {job.summary && <p className="mt-1 text-neutral-500">{job.summary}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(STATUS) as JobStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => patch({ status: s })}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    job.status === s
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white hover:bg-neutral-50"
                  }`}
                >
                  {STATUS[s].dot} {STATUS[s].label}
                </button>
              ))}
            </div>
          </div>
          <Link
            href={`/?zakazka=${job.id}`}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-base font-medium text-white shadow-soft transition hover:bg-brand-700 active:opacity-90"
          >
            {job.shareUrl ? "Nová ponuka pre kontakt" : "Vytvoriť ponuku"}
          </Link>
        </div>

        {/* Horní pruh: vlevo kontakt + odeslaná nabídka, vpravo poznámka + termíny. */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {/* Kontakt */}
            <section className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-soft">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Kontakt
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Meno a priezvisko" value={job.customer.name} placeholder="Ján Novák" onCommit={(v) => setCustomerField("name", v)} />
                <Field label="Obec" value={job.customer.obec} placeholder="Bratislava" onCommit={(v) => setCustomerField("obec", v)} />
                <Field label="Telefón" type="tel" value={job.customer.phone} placeholder="0901 234 567" onCommit={(v) => setCustomerField("phone", v)} />
                <Field label="E-mail" type="email" value={job.customer.email} placeholder="jan@email.sk" onCommit={(v) => setCustomerField("email", v)} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {job.customer.phone && (
                  <a href={`tel:${job.customer.phone}`} className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700">
                    Zavolať
                  </a>
                )}
                {job.customer.obec && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.customer.obec)}`} target="_blank" rel="noreferrer" className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50">
                    Navigovať
                  </a>
                )}
              </div>
            </section>

            {/* Odoslaná ponuka — jen když existuje. */}
            {job.shareUrl && <JobOffer shareUrl={job.shareUrl} priceExVat={job.priceExVat} />}

            {/* Parametry zakázky — v levém sloupci, ať vyplní prostor pod kontaktem. */}
            <DetailsForm details={job.details} onChange={(details) => patch({ details })} />
          </div>

          {/* Pravý sidebar */}
          <div className="space-y-5">
            {/* Poznámka */}
            <section className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-soft">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Poznámka</h2>
              <textarea
                value={job.note ?? ""}
                onChange={(e) => patch({ note: e.target.value || null })}
                rows={4}
                placeholder="Čo si treba pamätať…"
                className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
              />
            </section>

            {/* Termín realizace */}
            <section className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-soft">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">Termín realizácie</h2>
              <p className="mb-2 text-xs text-neutral-400">Kedy začneme pracovať.</p>
              <input
                type="date"
                value={job.startAt ? job.startAt.slice(0, 10) : ""}
                onChange={(e) => patch({ startAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
              />
            </section>

            {/* Připomenutí */}
            <section className="rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-soft">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">Pripomenúť zavolať</h2>
              <input
                type="date"
                value={job.remindAt ? job.remindAt.slice(0, 10) : ""}
                onChange={(e) => patch({ remindAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
              />
            </section>
          </div>
        </div>

        {/* Auto-marketing */}
        <div className="mt-5">
          <MarketingSection job={job} />
        </div>

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
