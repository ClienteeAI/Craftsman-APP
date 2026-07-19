"use client";

import { useState } from "react";

/**
 * Video zpráva pro zákazníka. #38.
 *
 * Fotoaparát telefonu (`capture`), ne nahrávání v prohlížeči — to skončilo
 * černým náhledem a nepřehratelným videem. Nativní kamera dá standardní MP4,
 * které se přes /api/video/[id] (s Range podporou) přehraje ve všech
 * prohlížečích: Safari, Chrome i Edge.
 *
 * ═══ CO SE MINULE POKAZILO ═══
 * "Priložené ✓" se ukázalo hned po výběru, ještě PŘED nahráním na server.
 * Fotoaparát dělá velké video, jeho nahrání trvá — a majster mezitím odeslal
 * nabídku s prázdným videem. Teď je stav poctivý: "Nahrávam…" → "✓" až po
 * potvrzení ze serveru, a chyba se řekne nahlas.
 */

// Video sa nahráva PRIAMO do Supabase Storage (nie cez server). Limit držíme
// pod výchozím limitom Supabase na súbor (50 MB) — pár sekúnd videa sa tam
// pohodlne vojde. Väčšie odmietneme rovno v prehliadači.
const MAX_MB = 50;

type Status = "idle" | "uploading" | "done" | "error";

export default function VideoMessage({
  onReady,
  onUploading,
}: {
  onReady: (videoId: string | null) => void;
  /** Hlásí rodiči, že video se právě nahrává — ať nejde odeslat nabídku bez něj. */
  onUploading?: (uploading: boolean) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    onReady(null); // starý videoId zneplatníme, dokud nový nedorazí
    const mb = Math.round(file.size / 1024 / 1024);
    if (file.size > MAX_MB * 1024 * 1024) {
      setStatus("error");
      setError(`Video je príliš veľké (${mb} MB). Natoč kratšie, do ${MAX_MB} MB.`);
      return;
    }
    if (file.size < 1000) {
      setStatus("error");
      setError("Video je prázdne — skús natočiť znova.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setStatus("uploading");
    onUploading?.(true);

    try {
      // Primárne: podpíš cieľ a nahraj PRIAMO do Supabase Storage — obchádza
      // Vercel 4,5 MB limit na request (video by inak spadlo ako veľká fotka).
      // Holý PUT na podpísanú URL (overené, funguje) — nie cez supabase-js.
      const signRes = await fetch("/api/video/sign", { method: "POST" });
      const sign = await signRes.json();
      if (sign.direct && sign.id && sign.token) {
        const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!base) throw new Error("Chýba adresa úložiska.");
        const url = `${base}/storage/v1/object/upload/sign/videos/${sign.id}?token=${encodeURIComponent(sign.token)}`;
        const up = await fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "video/mp4",
            ...(anon ? { apikey: anon } : {}),
          },
          body: file,
        });
        if (!up.ok) {
          const t = await up.text().catch(() => "");
          throw new Error(`Nahranie do úložiska zlyhalo (${up.status}). ${t.slice(0, 120)}`);
        }
        onReady(sign.id);
        setStatus("done");
        return;
      }

      // Fallback (demo bez Supabase): cez server. Pozor na 4,5 MB.
      const form = new FormData();
      form.append("video", file);
      const res = await fetch("/api/video", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      onReady(body.id); // AŽ teď je video reálně přiložené
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Video sa nepodarilo nahrať.");
      onReady(null);
    } finally {
      onUploading?.(false);
    }
  }

  function remove() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStatus("idle");
    setError(null);
    onReady(null);
  }

  const captureInput = (
    <input
      type="file"
      accept="video/*"
      capture="user"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void pick(f);
        e.target.value = ""; // ať jde vybrat to samé znova
      }}
    />
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200">
      <div className="border-b border-neutral-100 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Videopozdrav (nepovinné)
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Natoč pár sekúnd do kamery. Zákazník uvidí, s kým má do činenia — proti
          tomu nemá ponuka v prílohe šancu.
        </p>
      </div>

      <div className="p-5">
        {status === "idle" || status === "error" ? (
          <label className="flex w-full cursor-pointer items-center justify-center rounded-xl border border-neutral-300 py-3.5 text-base font-medium active:bg-neutral-100">
            Nahrať videopozdrav
            {captureInput}
          </label>
        ) : (
          <>
            {previewUrl && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={previewUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-xl bg-black"
                style={{ maxHeight: "50vh" }}
              />
            )}

            {status === "uploading" && (
              <p className="mt-3 flex items-center justify-center gap-2 text-sm text-neutral-500">
                <span className="h-3 w-3 animate-pulse rounded-full bg-neutral-400" />
                Nahrávam video… nechaj to dobehnúť pred odoslaním.
              </p>
            )}

            {status === "done" && (
              <>
                <p className="mt-3 text-center text-sm font-medium text-green-700">
                  Videopozdrav priložený k ponuke ✓
                </p>
                <div className="mt-3 flex gap-2">
                  <label className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-neutral-300 py-3 text-base font-medium active:bg-neutral-100">
                    Natočiť znova
                    {captureInput}
                  </label>
                  <button
                    onClick={remove}
                    className="rounded-xl border border-neutral-300 px-5 py-3 text-base font-medium text-neutral-500 active:bg-neutral-100"
                  >
                    Odstrániť
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {error && (
          <div className="mt-3">
            <p className="text-sm text-red-600">{error}</p>
            <label className="mt-2 inline-flex cursor-pointer text-sm font-medium underline underline-offset-4">
              Skúsiť znova
              {captureInput}
            </label>
          </div>
        )}
      </div>
    </section>
  );
}
