"use client";

import { useEffect, useState } from "react";

/**
 * Odeslaná nabídka na detailu zakázky.
 *
 * Řemeslník otevře zakázku a hned vidí, co poslal a jak na to zákazník reaguje
 * — cena, odkaz na otevření, a živý stav (otevřel / má zájem / vybral / podepsal).
 * Dřív tu byl jen kontakt; tohle je ta druhá půlka: co se s nabídkou děje.
 */

const eur = (n: number | null) =>
  n == null
    ? null
    : new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

type Status = {
  openedAt: string | null;
  interestedAt: string | null;
  chosenTier: string | null;
  signedAt: string | null;
};

export default function JobOffer({
  shareUrl,
  priceExVat,
}: {
  shareUrl: string;
  priceExVat: number | null;
}) {
  const id = shareUrl.split("/p/")[1] ?? null;
  const [st, setSt] = useState<Status | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/share/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const b = await res.json();
        if (alive) setSt({ openedAt: b.openedAt, interestedAt: b.interestedAt, chosenTier: b.chosenTier, signedAt: b.signedAt });
      } catch {
        /* bez signálu zkusíme příště */
      }
    }
    void load();
    const timer = setInterval(() => {
      if (!st?.signedAt) void load();
    }, 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Nejsilnější dosažený stav → jedna jasná věta.
  const stage = st?.signedAt
    ? { label: "✍️ Podpísaná — závazne objednané", cls: "bg-green-700 text-white" }
    : st?.chosenTier
      ? { label: "🔥 Zákazník si vybral úroveň", cls: "bg-green-600 text-white" }
      : st?.interestedAt
        ? { label: "🔥 Zákazník má záujem", cls: "bg-green-600 text-white" }
        : st?.openedAt
          ? { label: "👀 Zákazník ju otvoril", cls: "bg-neutral-900 text-white" }
          : { label: "Odoslaná — čaká sa", cls: "bg-neutral-100 text-neutral-600" };

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200/70 bg-white shadow-soft p-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
        Odoslaná ponuka
      </h2>

      {eur(priceExVat) && (
        <p className="text-2xl font-semibold tracking-tight">
          {eur(priceExVat)} <span className="text-sm font-normal text-neutral-400">bez DPH</span>
        </p>
      )}

      <div className={`mt-3 inline-block rounded-full px-3 py-1.5 text-sm font-medium ${stage.cls}`}>
        {stage.label}
      </div>

      <a
        href={shareUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex items-center justify-center rounded-xl border border-neutral-300 py-3 text-base font-medium active:bg-neutral-100"
      >
        Otvoriť ponuku, ktorú vidí zákazník
      </a>
    </section>
  );
}
