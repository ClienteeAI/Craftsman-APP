"use client";

import { useState } from "react";
import type { OfferTier } from "@/lib/quote/store";

/**
 * Výběr cenové úrovně zákazníkem („zeptej se manželky").
 *
 * Zákazník nerozhoduje áno/nie, ale ktorú z troch — a keďže sa úrovne líšia
 * škridlou, vyberá si aj vzhľad aj cenu naraz. Voľba sa hneď pošle majstrovi.
 */

const eur = (n: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export default function TierVote({
  id,
  tiers,
  initialChosen,
}: {
  id: string;
  tiers: OfferTier[];
  initialChosen: string | null;
}) {
  const [chosen, setChosen] = useState<string | null>(initialChosen);
  const [busy, setBusy] = useState<string | null>(null);

  async function choose(tierId: string) {
    setChosen(tierId); // optimisticky
    setBusy(tierId);
    try {
      await fetch(`/api/share/${id}/choose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierId }),
        keepalive: true,
      });
    } catch {
      /* best-effort — voľbu má majster aj tak vidieť pri ďalšom obnovení */
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-6">
      <p className="text-xs uppercase tracking-widest text-neutral-400">Vyberte si úroveň</p>
      <div className="mt-3 space-y-3">
        {tiers.map((t) => {
          const active = chosen === t.id;
          return (
            <button
              key={t.id}
              onClick={() => choose(t.id)}
              className={`block w-full rounded-2xl border-2 p-5 text-left transition ${
                active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{t.name}</span>
                {active && <span className="text-sm">Vybrané ✓</span>}
              </div>
              <p className={`mt-1 text-sm ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                {t.productName}
              </p>
              <p className="mt-3 text-2xl font-semibold tracking-tight">
                {eur(t.range.from)} – {eur(t.range.to)}
              </p>
              <p className={`mt-0.5 text-sm ${active ? "text-neutral-400" : "text-neutral-500"}`}>
                bez DPH · {eur(t.totals.totalIncVat)} s DPH
              </p>
              {busy === t.id && (
                <p className={`mt-2 text-xs ${active ? "text-neutral-400" : "text-neutral-400"}`}>
                  Ukladám voľbu…
                </p>
              )}
            </button>
          );
        })}
      </div>
      {chosen && (
        <p className="mt-3 text-center text-sm font-medium text-green-700">
          Ďakujeme za výber — majster sa vám ozve.
        </p>
      )}
    </section>
  );
}
