"use client";

import { useState } from "react";
import type { SolarEstimate as Est } from "@/lib/quote/solar";

/**
 * Solárny odhad v nabídke. Upsell + wow.
 *
 * „Vaša strecha by ročne vyrobila X kWh" — z reálnych dát PVGIS. Silný dôvod
 * dokúpiť FV k novej streche (ideálny moment, keď je aj tak hore).
 */

// Orientace střechy → azimut podle PVGIS (0 jih, − východ, + západ).
const ORIENTS: [string, number][] = [
  ["Juh", 0],
  ["Juhovýchod", -45],
  ["Juhozápad", 45],
  ["Východ", -90],
  ["Západ", 90],
];

// Orientační cena elektřiny pro odhad úspory (€/kWh).
const PRICE_PER_KWH = 0.2;

export default function SolarEstimate({
  obec,
  areaM2,
  pitchDeg,
}: {
  obec: string | null;
  areaM2: number | null;
  pitchDeg: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [aspect, setAspect] = useState(0);
  const [est, setEst] = useState<Est | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!areaM2) return null;

  async function calc() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/solar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obec, areaM2, pitchDeg, aspect }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Nepodarilo sa.");
      setEst(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Odhad sa nepodaril.");
    } finally {
      setBusy(false);
    }
  }

  const savings = est ? Math.round(est.annualKwh * PRICE_PER_KWH) : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <span>
          <span className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            ☀️ Solár na túto strechu
          </span>
          <span className="mt-0.5 block text-sm text-neutral-500">
            Koľko by vyrobila fotovoltika
          </span>
        </span>
        <span className="text-neutral-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-neutral-100 p-5">
          <p className="mb-2 text-sm text-neutral-500">Orientácia strechy (kam smeruje):</p>
          <div className="flex flex-wrap gap-2">
            {ORIENTS.map(([label, val]) => (
              <button
                key={val}
                onClick={() => setAspect(val)}
                className={`rounded-full px-3.5 py-2 text-sm font-medium ${
                  aspect === val
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-200 bg-white text-neutral-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={calc}
            disabled={busy}
            className="mt-3 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white active:opacity-80 disabled:opacity-40"
          >
            {busy ? "Počítam…" : "Spočítať výrobu"}
          </button>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {est && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-2xl font-semibold tracking-tight text-neutral-900">
                ≈ {est.annualKwh.toLocaleString("sk-SK")} kWh / rok
              </p>
              <p className="mt-1 text-sm text-neutral-600">
                Elektráreň ≈ {est.kWp} kWp na ≈ {est.usableAreaM2} m² využiteľnej plochy.
                Ušetrí zhruba <span className="font-medium">{savings.toLocaleString("sk-SK")} € ročne</span>.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                Orientačný odhad z dát PVGIS (Európska komisia)
                {est.approxLocation ? " a približnej polohy" : ""}. Presnú výrobu určí projekt.
                Najlepší čas riešiť je teraz, keď je strecha aj tak hore.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
