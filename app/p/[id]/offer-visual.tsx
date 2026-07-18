"use client";

import { useState } from "react";

/**
 * Interaktivní vizualizace na ZÁKAZNICKÉ nabídce.
 *
 * Posuvník před/po (táhne prstem a jeho barák se mění) + přepínače:
 *   - Krytina: pozrie si každú tašku na SVOJEJ streche (to, čo chce vidieť)
 *   - Atmosféra: ako to vyzerá v zime, večer, o 15 rokov
 * Žiadne AI volania — prepína medzi obrázkami, čo majster pripravil dopredu.
 * Takže zákazník si klikaním nič nespustí a nikoho to nič nestojí.
 */

const ATMO: Record<string, string> = {
  leto: "☀️ Leto",
  sneh: "❄️ Sneh",
  vecer: "🌇 Večer",
  starnutie: "⏳ O 15 rokov",
};

export default function OfferVisual({
  before,
  afterDefault,
  variants,
  tiles,
}: {
  before: string | null;
  afterDefault: string;
  variants: { key: string; url: string }[];
  tiles: { key: string; label: string; url: string }[];
}) {
  const [after, setAfter] = useState(afterDefault);
  const [split, setSplit] = useState(50);

  const tileOpts = tiles.length > 1 ? tiles : [];
  const atmoOpts = variants.map((v) => ({ key: v.key, label: ATMO[v.key] ?? v.key, url: v.url }));

  function Switcher({ title, opts }: { title: string; opts: { key: string; label: string; url: string }[] }) {
    if (opts.length === 0) return null;
    return (
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-neutral-400">{title}</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {opts.map((o) => (
            <button
              key={o.key}
              onClick={() => setAfter(o.url)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition ${
                after === o.url
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {before ? (
        <div className="relative select-none overflow-hidden rounded-2xl border border-neutral-200/70 shadow-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt="Pôvodná strecha" className="block w-full" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={after}
            alt="Nová strecha"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 0 0 ${split}%)` }}
          />
          <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/50 px-2 py-1 text-xs font-medium text-white">
            Teraz
          </span>
          <span className="pointer-events-none absolute right-3 top-3 rounded bg-black/50 px-2 py-1 text-xs font-medium text-white">
            Nová
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            aria-label="Posuvník pred a po"
            className="absolute inset-x-0 bottom-3 mx-auto w-[90%] cursor-ew-resize"
          />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={after}
          alt="Vizualizácia vašej strechy"
          className="block w-full rounded-2xl border border-neutral-200/70 shadow-soft"
        />
      )}

      {before && (
        <p className="mt-2 text-center text-xs text-neutral-400">Potiahnite posuvník — vaša strecha sa zmení</p>
      )}

      <Switcher title="Krytina" opts={tileOpts} />
      <Switcher title="Atmosféra" opts={atmoOpts} />
    </div>
  );
}
