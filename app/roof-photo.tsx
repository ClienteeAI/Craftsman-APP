"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoofFinding } from "@/lib/quote/inspect";

type Phase = "empty" | "masking" | "rendering" | "done" | "error";

/**
 * Vizualizace střechy uvnitř nabídky.
 *
 * Produkt se NEVYBÍRÁ — apka ho už zná z toho, co majster nadiktoval.
 * Přijde sem hotové `productId` z nabídky a jen se vyrenderuje.
 */
export default function RoofPhoto({
  productId,
  productName,
  onRendered,
  onGallery,
  initialPhoto,
}: {
  productId: string;
  productName: string;
  /** Základní render (after) putuje nahoru — je to hlavní obrázek nabídky. */
  onRendered?: (dataUrl: string | null) => void;
  /** Galerie pro zákazníka: původní fotka (before) + vygenerované varianty.
      Díky ní má zákazník na nabídce posuvník před/po a přepínač atmosféry. */
  onGallery?: (g: {
    before: string | null;
    variants: { key: string; url: string }[];
    tiles: { key: string; label: string; url: string }[];
  }) => void;
  /** Fotka z mailu — natáhne se sem, ať ji majster nemusí nahrávat znova. */
  initialPhoto?: File | null;
}) {
  const [phase, setPhase] = useState<Phase>("empty");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Atmosférické varianty (léto/sníh/večer/stárnutí). Základní render si držíme
  // zvlášť, ať jde přepínat tam a zpět; hotové varianty cachujeme.
  const baseResult = useRef<{ objUrl: string; dataUrl: string } | null>(null);
  const variantCache = useRef<Map<string, { objUrl: string; dataUrl: string }>>(new Map());
  /** Původní fotka jako data URL — „before" do galerie pro zákazníka. */
  const beforeDataUrl = useRef<string | null>(null);
  /** Poslední maska (obtažení střechy). Uložíme ji, ať jde překreslit pro jinou
      tašku bez nutnosti kreslit masku znovu — render pak jede i z „hotového" stavu. */
  const lastMask = useRef<Blob | null>(null);
  /** Majster vybral jinou krytinu, než je vygenerovaná → render je zastaralý.
      Nekreslíme automaticky (stálo by to peníze); počkáme na jeho „Prekresliť". */
  const [staleTile, setStaleTile] = useState(false);
  const [activeVariant, setActiveVariant] = useState<string>("original");
  const [varying, setVarying] = useState<string | null>(null);
  const [brush, setBrush] = useState(44);
  const [hasMask, setHasMask] = useState(false);
  const [split, setSplit] = useState(50);
  // Diagnóza z fotky — soukromá pomůcka pro majstra, ne text pro zákazníka.
  const [findings, setFindings] = useState<RoofFinding[] | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  /** Poslední vyrenderovaná taška — ať nerenderujeme dvakrát to samé. */
  const renderedFor = useRef<string | null>(null);
  const renderRef = useRef<() => Promise<void>>(async () => {});

  const sizeCanvas = useCallback(() => {
    const img = imgRef.current;
    const c = canvasRef.current;
    if (!img || !c) return;
    const { width, height } = img.getBoundingClientRect();
    if (!width || !height) return;
    if (c.width === Math.round(width) && c.height === Math.round(height)) return;
    c.width = Math.round(width);
    c.height = Math.round(height);
  }, []);

  useEffect(() => {
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    return () => window.removeEventListener("resize", sizeCanvas);
  }, [sizeCanvas, photoUrl]);

  function paint(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const r = c.getBoundingClientRect();
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.beginPath();
    ctx.arc(e.clientX - r.left, e.clientY - r.top, brush / 2, 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  }

  /** Diagnóza z fotky. Selhání tiše spolkneme — je to bonus, ne blokující krok. */
  async function inspect(file: File) {
    setInspecting(true);
    setFindings(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/inspect", { method: "POST", body: form });
      if (!res.ok) return;
      const data = await res.json();
      setFindings(data.findings ?? []);
    } catch {
      // Diagnóza je pomůcka navíc. Když spadne, apka jede dál bez ní.
    } finally {
      setInspecting(false);
    }
  }

  /** Fotka přišla z mailu → natáhneme ji sem a rovnou spustíme diagnózu. */
  const loadedPhoto = useRef<File | null>(null);
  useEffect(() => {
    if (initialPhoto && loadedPhoto.current !== initialPhoto) {
      loadedPhoto.current = initialPhoto;
      setPhotoFile(initialPhoto);
      setPhotoUrl(URL.createObjectURL(initialPhoto));
      setPhase("masking");
      setHasMask(false);
      void inspect(initialPhoto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhoto]);

  /** Pošle nahoru galerii pro zákazníka: before + atmosférické varianty.
   *
   * Krytinu si vyberá MAJSTER — zákazník vidí len finálnu (hlavný render, cez
   * onRendered). Preto sem tiles NEposielame: keby sme balili každú prezretú
   * tašku do ponuky, zákazník by nimi krútil a každá by musela byť vygenerovaná
   * navyše (peniaze). Takto sa generuje len to, čo majster reálne ukáže. */
  function emitGallery() {
    if (!onGallery) return;
    const variants = Array.from(variantCache.current.entries()).map(([key, v]) => ({
      key,
      url: v.dataUrl,
    }));
    onGallery({ before: beforeDataUrl.current, variants, tiles: [] });
  }

  async function render() {
    if (!photoFile) return;
    setPhase("rendering");
    setError(null);
    // Masku vezmi z plátna (keď kreslíme), inak z uloženej — nech ide prekresliť
    // inú tašku aj z „hotového" stavu, bez opätovného kreslenia masky.
    let mask = lastMask.current;
    const c = canvasRef.current;
    if (c) {
      const fresh: Blob | null = await new Promise((res) => c.toBlob(res, "image/png"));
      if (fresh) mask = fresh;
    }
    if (!mask) {
      setPhase("masking");
      return setError("Označ prstom strechu, ktorú meníš.");
    }
    lastMask.current = mask;

    const form = new FormData();
    form.append("photo", photoFile);
    form.append("mask", mask, "mask.png");
    form.append("productId", productId);

    try {
      const res = await fetch("/api/render", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      setResultUrl(objUrl);
      // Nový základní render → zahodíme staré varianty a vrátíme se na „pôvodné".
      variantCache.current.clear();
      setActiveVariant("original");
      // data URL, ne object URL — object URL platí jen v této záložce a na
      // serveru by z něj nešlo nic uložit.
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        baseResult.current = { objUrl, dataUrl };
        onRendered?.(dataUrl);
        emitGallery();
      };
      reader.readAsDataURL(blob);
      // Původní fotka jako data URL — „before" do galerie.
      const beforeReader = new FileReader();
      beforeReader.onload = () => {
        beforeDataUrl.current = String(beforeReader.result);
        emitGallery();
      };
      beforeReader.readAsDataURL(photoFile);
      renderedFor.current = productId;
      setStaleTile(false); // práve vygenerované pre aktuálnu krytinu
      setSplit(50);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Render zlyhal.");
    }
  }
  renderRef.current = render;

  /**
   * Přepnutí atmosférické varianty (léto/sníh/večer/stárnutí) nad hotovým
   * renderem. Jen PREVIEW pro majstra — hlavní obrázek nabídky („nová strecha")
   * zůstává čistý render, atmosféry se k němu přidají jako přepínatelné navíc.
   * Proto tady NEsaháme na onRendered; jen do galerie přes emitGallery.
   */
  async function applyVariant(key: string) {
    const base = baseResult.current;
    if (!base || varying) return;

    if (key === "original") {
      setResultUrl(base.objUrl);
      setActiveVariant("original");
      return;
    }

    const cached = variantCache.current.get(key);
    if (cached) {
      setResultUrl(cached.objUrl);
      setActiveVariant(key);
      return;
    }

    setVarying(key);
    setError(null);
    try {
      const res = await fetch("/api/render/variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base.dataUrl, variant: key }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        variantCache.current.set(key, { objUrl, dataUrl });
        setResultUrl(objUrl);
        setActiveVariant(key);
        emitGallery(); // varianta se přidá do galerie pro zákazníka (hlavní render se nemění)
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Variant sa nepodaril.");
    } finally {
      setVarying(null);
    }
  }

  /**
   * Majster přepnul krytinu → NErenderujeme automaticky (stálo by to peníze za
   * každou prohlédnutou tašku). Jen označíme render za zastaralý; skutečné
   * překreslení spustí majster vědomě tlačítkem „Prekresliť". Výběr tašky podle
   * katalogu je zdarma; platí se až za render finální volby.
   */
  useEffect(() => {
    if (renderedFor.current && renderedFor.current !== productId) {
      setStaleTile(true);
    }
  }, [productId]);

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200">
      <div className="border-b border-neutral-100 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Vizualizácia</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {phase === "done"
            ? `Takto bude strecha vyzerať s krytinou ${productName}.`
            : `Pridaj fotku z obhliadky a ukážeš zákazníkovi jeho dom s krytinou ${productName}.`}
        </p>
      </div>

      {phase === "empty" && (
        <label className="flex h-40 cursor-pointer items-center justify-center border-2 border-dashed border-neutral-200 m-5 rounded-xl hover:border-neutral-400">
          <span className="text-sm text-neutral-400">Ťukni a vyber fotku strechy</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setPhotoFile(f);
              setPhotoUrl(URL.createObjectURL(f));
              setPhase("masking");
              setHasMask(false);
              // Diagnóza běží na pozadí, hned po výběru — než majster domaluje
              // masku, má na obrazovce, co na střeše je.
              void inspect(f);
            }}
          />
        </label>
      )}

      {photoUrl && phase !== "done" && (
        <div className="p-5">
          <div className="relative inline-block max-w-full select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={photoUrl}
              alt="Fotka strechy"
              onLoad={sizeCanvas}
              className="block max-h-[50vh] w-auto max-w-full rounded-xl"
            />
            <canvas
              ref={canvasRef}
              className="absolute left-0 top-0 cursor-crosshair touch-none rounded-xl opacity-40"
              onPointerDown={(e) => {
                drawing.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                paint(e);
              }}
              onPointerMove={(e) => drawing.current && paint(e)}
              onPointerUp={() => (drawing.current = false)}
              onPointerLeave={() => (drawing.current = false)}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-neutral-400">
              Štetec
              <input type="range" min={12} max={120} value={brush} onChange={(e) => setBrush(+e.target.value)} />
            </label>
            <button
              onClick={render}
              disabled={!hasMask || phase === "rendering"}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-30"
            >
              {phase === "rendering" ? "Kreslím strechu…" : "Ukázať novú strechu"}
            </button>
            <span className="text-xs text-neutral-400">
              {hasMask ? "" : "Prejdi prstom po streche"}
            </span>
          </div>

          <FindingsPanel findings={findings} loading={inspecting} />
        </div>
      )}

      {phase === "done" && photoUrl && resultUrl && (
        <div className="p-5">
          <BeforeAfter before={photoUrl} after={resultUrl} split={split} onSplit={setSplit} />

          {/* Vybral inú krytinu → render je starý. Prekreslenie je vedomý krok
              (jeden render = jedna platba), preto naň čakáme, nespúšťame sami. */}
          {staleTile && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-sm text-amber-900">
                Vybral si krytinu <span className="font-medium">{productName}</span> — vizualizácia je ešte pôvodná.
              </span>
              <button
                onClick={render}
                disabled={phase !== "done"}
                className="shrink-0 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
              >
                Prekresliť
              </button>
            </div>
          )}

          {/* Atmosférické varianty — obrázek, který si zákazník uloží. */}
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-400">
              Atmosféra
            </p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {(
                [
                  ["original", "Pôvodné"],
                  ["leto", "☀️ Leto"],
                  ["sneh", "❄️ Sneh"],
                  ["vecer", "🌇 Večer"],
                  ["starnutie", "⏳ O 15 rokov"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => applyVariant(key)}
                  disabled={varying !== null}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium disabled:opacity-50 ${
                    activeVariant === key
                      ? "bg-brand-600 text-white"
                      : "border border-neutral-200 bg-white text-neutral-600"
                  }`}
                >
                  {varying === key ? "Kreslím…" : label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setPhase("masking")}
            className="mt-3 text-sm text-neutral-500 underline underline-offset-4"
          >
            Upraviť masku
          </button>
        </div>
      )}

      {error && <p className="mx-5 mb-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}

function BeforeAfter({
  before,
  after,
  split,
  onSplit,
}: {
  before: string;
  after: string;
  split: number;
  onSplit: (v: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  function move(x: number) {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onSplit(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
  }
  return (
    <div
      ref={box}
      className="relative inline-block max-w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-xl"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt="Pôvodná strecha" className="block max-h-[50vh] w-auto max-w-full" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={after}
        alt="Nová strecha"
        className="absolute inset-0 h-full w-full"
        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
      />
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90" style={{ left: `${split}%` }}>
        <div className="absolute top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/20 backdrop-blur" />
      </div>
    </div>
  );
}

/**
 * "Čo vidno na streche" — soukromá pomůcka pro majstra.
 *
 * SCHVÁLNĚ jen pro jeho oči, ne do nabídky pro zákazníka. Kdyby to šlo rovnou
 * zákazníkovi a model se spletl, majster vypadá jako podvodník. Takhle je to
 * checklist: majster se rozhodne, co z toho do nabídky dá.
 *
 * Nálezy "low" jsou vizuálně odlišené — majster hned vidí, čemu věřit a co
 * ověřit na místě.
 */
function FindingsPanel({ findings, loading }: { findings: RoofFinding[] | null; loading: boolean }) {
  if (loading) {
    return <p className="mt-5 text-sm text-neutral-400">Pozerám na strechu…</p>;
  }
  if (!findings) return null;
  if (findings.length === 0) {
    return <p className="mt-5 text-sm text-neutral-500">Na fotke nevidím nič zvláštne.</p>;
  }

  return (
    <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        Čo vidno na streche
      </p>
      <p className="mt-1 text-xs text-neutral-400">Pomôcka pre teba — zákazník to nevidí.</p>
      <ul className="mt-3 space-y-2.5">
        {findings.map((f, n) => (
          <li key={n} className="flex items-start gap-2">
            <span
              className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                f.confidence === "high"
                  ? "bg-brand-600 text-white"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {f.confidence === "high" ? "vidno" : "over"}
            </span>
            <span className="text-[15px] leading-snug">
              <span className="font-medium">{f.label}.</span>{" "}
              <span className="text-neutral-600">{f.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
