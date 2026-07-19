"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Interaktivní vizualizace na ZÁKAZNICKÉ nabídce — hlavní „wow".
 *
 * Přetahovací předěl před/po: zákazník táhne prstem přímo přes fotku SVOJHO
 * baráku a střecha se mění. Plus přepínače krytiny a atmosféry. Žádné AI volání
 * — přepíná mezi obrázky, co majster připravil dopředu, takže klikání nikoho
 * nic nestojí.
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [hinted, setHinted] = useState(false);

  const tileOpts = tiles.length > 1 ? tiles : [];
  const atmoOpts = variants.map((v) => ({ key: v.key, label: ATMO[v.key] ?? v.key, url: v.url }));

  // Nájezdová nápověda: předěl se jednou sám pohne, aby bylo jasné, že se táhne.
  useEffect(() => {
    if (!before) return;
    const t1 = setTimeout(() => setSplit(68), 600);
    const t2 = setTimeout(() => setSplit(34), 1050);
    const t3 = setTimeout(() => {
      setSplit(50);
      setHinted(true);
    }, 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [before]);

  function setFromClientX(clientX: number) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(0, Math.min(100, pct)));
  }
  function onDown(e: React.PointerEvent) {
    dragging.current = true;
    setHinted(true);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  }
  function onMove(e: React.PointerEvent) {
    if (dragging.current) setFromClientX(e.clientX);
  }
  function onUp() {
    dragging.current = false;
  }

  // Náhledové dlaždice — každá ukáže reálny obrázok tej krytiny/atmosféry.
  function Switcher({ title, opts }: { title: string; opts: { key: string; label: string; url: string }[] }) {
    if (opts.length === 0) return null;
    return (
      <div className="mt-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">{title}</p>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
          {opts.map((o) => {
            const active = after === o.url;
            return (
              <button key={o.key} onClick={() => setAfter(o.url)} className="shrink-0 text-center">
                <div
                  className={`h-[68px] w-[68px] overflow-hidden rounded-2xl border-2 transition ${
                    active ? "border-brand-600 shadow-lift" : "border-transparent opacity-80"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.url} alt={o.label} className="h-full w-full object-cover" draggable={false} />
                </div>
                <span className={`mt-1.5 block text-xs ${active ? "font-semibold text-neutral-800" : "text-neutral-500"}`}>
                  {o.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6" style={{ animation: "fadeInUp 0.55s ease both" }}>
      {before ? (
        <div
          ref={wrapRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ touchAction: "pan-y" }}
          className="relative -mx-5 cursor-ew-resize select-none overflow-hidden border-y border-neutral-200/70 shadow-lift sm:mx-0 sm:rounded-3xl sm:border"
        >
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

          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            Teraz
          </span>
          <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-brand-600/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            Nová
          </span>

          {/* Předěl + úchyt */}
          <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split}%` }}>
            <div className="absolute inset-y-0 -ml-[1.5px] w-[3px] bg-white/95 shadow-[0_0_8px_rgba(0,0,0,0.35)]" />
            <div
              className={`absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-700 shadow-lift ${
                hinted ? "" : "animate-pulse"
              }`}
            >
              <span className="text-lg leading-none tracking-tighter">‹›</span>
            </div>
          </div>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={after}
          alt="Vizualizácia vašej strechy"
          className="block w-full rounded-3xl border border-neutral-200/70 shadow-lift"
        />
      )}

      {before && (
        <p className="mt-2.5 text-center text-xs text-neutral-400">
          {hinted ? "Potiahnite prstom — vaša strecha sa zmení" : "👆 Potiahnite prstom cez fotku"}
        </p>
      )}

      <Switcher title="Krytina" opts={tileOpts} />
      <Switcher title="Atmosféra" opts={atmoOpts} />
    </div>
  );
}
