"use client";

import { useRef, useState } from "react";

/**
 * Závazný podpis nabídky přímo v odkazu. „Z týdnů na hodinu."
 *
 * Zákazník prstem podepíše a objedná — bez tisku, skenování a pošty. Majstrovi
 * to hned naskočí (push „podpísal"). Podpis se uloží jako obrázek k nabídce.
 */
export default function SignOffer({
  id,
  initialSigned,
}: {
  id: string;
  initialSigned: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [signed, setSigned] = useState(initialSigned);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = pos(e);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  }

  function stop() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const c = canvasRef.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  async function submit() {
    const c = canvasRef.current;
    if (!c || !hasInk) return;
    setBusy(true);
    setError(null);
    try {
      const signature = c.toDataURL("image/png");
      const res = await fetch(`/api/share/${id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Nepodarilo sa.");
      setSigned(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Podpis sa nepodaril.");
    } finally {
      setBusy(false);
    }
  }

  if (signed) {
    return (
      <section className="mt-6 rounded-2xl border-2 border-green-600 bg-green-50 p-5 text-center">
        <p className="text-[15px] font-semibold text-green-800">Objednávka podpísaná ✓</p>
        <p className="mt-1 text-sm text-green-700">Majster sa vám ozve a dohodnete termín.</p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
      {!open ? (
        <>
          <p className="text-[15px] font-medium">Chcete to záväzne objednať?</p>
          <p className="mt-1 text-sm text-neutral-500">
            Podpíšte prstom rovno tu — bez tlače a skenovania.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="mt-3 rounded-xl bg-neutral-900 px-5 py-3 text-base font-medium text-white active:opacity-80"
          >
            Záväzne objednať
          </button>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm text-neutral-500">Podpíšte sa do rámčeka:</p>
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={stop}
            onPointerLeave={stop}
            className="w-full touch-none rounded-xl border border-neutral-300 bg-neutral-50"
            style={{ height: 160 }}
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={submit}
              disabled={!hasInk || busy}
              className="flex-1 rounded-xl bg-neutral-900 py-3 text-base font-medium text-white active:opacity-80 disabled:opacity-40"
            >
              {busy ? "Odosielam…" : "Podpísať a objednať"}
            </button>
            <button
              onClick={clear}
              className="rounded-xl border border-neutral-300 px-4 py-3 text-base font-medium active:bg-neutral-100"
            >
              Zmazať
            </button>
          </div>
        </>
      )}
    </section>
  );
}
