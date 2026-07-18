"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Extraction, FollowUp, RoofJob } from "@/lib/quote/types";
import { SCOPE_ITEMS, type ScopeItem } from "@/lib/quote/types";
import type { PricedItem, Quote } from "@/lib/quote/pricing";
import type { RoofProduct } from "@/lib/quote/products";
import type { TierId, TieredQuote } from "@/lib/quote/tiers";
import { checkQuote, type CheckFinding } from "@/lib/quote/check";
import { getJob, upsertJob } from "@/lib/crm/jobs";
import type { JobDetails } from "@/lib/crm/job-details";
import { loadProfile } from "@/lib/quote/profile-store";
import { recomputeTotals, repriceItem } from "@/lib/quote/totals";
import { deleteTemplate, listTemplates, saveTemplate, type Template } from "@/lib/quote/templates";
import RoofPhoto from "./roof-photo";
import VideoMessage from "./video-message";
import ShoppingList from "./shopping-list";
import WorkOrder from "./work-order";
import SolarEstimate from "./solar-estimate";

type Result = Extraction & { tiers: TieredQuote[]; product: RoofProduct | null };
type Phase = "idle" | "recording" | "transcribing" | "thinking" | "done" | "error";

const eur = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export default function QuoteFlow({ company }: { company: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  // QuoteCard si drží upravené položky ve stavu. Když přijde nová nabídka
  // (doptání na sklon), musí se nasadit znovu — jinak by ukazoval stará čísla.
  const [version, setVersion] = useState(0);
  // Štandard je předvybraný schválně. Většina lidí sáhne doprostřed a ten,
  // kdo nastaví, co je "normální", tím rozhoduje o průměrné tržbě.
  const [tier, setTier] = useState<TierId>("standard");
  // Stav, který si sem hlásí děti — bez toho nemá "Poslať" co poslat.
  const [customer, setCustomer] = useState<RoofJob["customer"]>({
    name: null,
    obec: null,
    phone: null,
    email: null,
  });
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  // Galerie pro zákazníka: původní fotka + vygenerované varianty (posuvník
  // před/po a přepínač atmosféry na zákaznické stránce).
  const [gallery, setGallery] = useState<{
    before: string | null;
    variants: { key: string; url: string }[];
    tiles: { key: string; label: string; url: string }[];
  }>({ before: null, variants: [], tiles: [] });
  const [videoId, setVideoId] = useState<string | null>(null);
  // Když nabídka vznikla z existujícího kontaktu (/?zakazka=id), držíme si jeho
  // id + jméno. Id, aby se hotová nabídka přilepila na TU kartu (a ne založila
  // druhou), jméno pro fallback a pro lištu "děláš nabídku pre…".
  const [linkedJobId, setLinkedJobId] = useState<string | null>(null);
  const [linkedCustomer, setLinkedCustomer] = useState<RoofJob["customer"] | null>(null);
  // Fotky vložené/nahrané z mailu. První se použije na střechu (vizualizace
  // + diagnóza), ať majster nemusí nic nahrávat zvlášť.
  const [mailPhotos, setMailPhotos] = useState<File[]>([]);
  // Šablony častých zakázek — „dělám pořád to samé".
  const [templates, setTemplates] = useState<Template[]>([]);
  const [videoUploading, setVideoUploading] = useState(false);
  const [live, setLive] = useState<{
    items: PricedItem[];
    totals: ReturnType<typeof recomputeTotals>;
  } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // „Zeptej se manželky" — poslat všechny 3 úrovně, ať si zákazník vybere.
  const [letChoose, setLetChoose] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  // Otevřeno z detailu kontaktu (tlačítko "Vytvoriť ponuku"). Načteme zákazníka
  // a jeho poznámku předhodíme AI jako kontext — majster pak už jen prilepí
  // mail nebo řekne, co na střeše viděl. window.location, ať to nevyžaduje
  // Suspense hranici kolem useSearchParams.
  useEffect(() => {
    const zid = new URLSearchParams(window.location.search).get("zakazka");
    if (!zid) return;
    const job = getJob(zid);
    if (!job) return;
    setLinkedJobId(job.id);
    setLinkedCustomer(job.customer);
    setCustomer(job.customer);
    if (job.note) setTranscript(job.note);
  }, []);

  useEffect(() => setTemplates(listTemplates()), []);

  function saveCurrentAsTemplate() {
    const name = window.prompt("Názov šablóny:", transcript.slice(0, 30));
    if (!name?.trim()) return;
    saveTemplate(name, transcript);
    setTemplates(listTemplates());
  }

  function removeTemplate(id: string) {
    deleteTemplate(id);
    setTemplates(listTemplates());
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await transcribe(new Blob(chunks.current, { type: "audio/webm" }));
      };
      recorder.current = mr;
      mr.start();
      setPhase("recording");
    } catch {
      setPhase("error");
      setError("Nepodarilo sa spustiť mikrofón. Skús text.");
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    setPhase("transcribing");
  }

  async function transcribe(audio: Blob) {
    try {
      const form = new FormData();
      form.append("audio", audio, "nahravka.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setTranscript(body.transcript);
      await analyse(body.transcript);
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Prepis zlyhal.");
    }
  }

  async function analyse(text: string) {
    setPhase("thinking");
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, profile: loadProfile() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setResult(body);
      setVersion((v) => v + 1);
      setShareUrl(null);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Nepodarilo sa spracovať.");
    }
  }

  /**
   * Odpovědi na VŠECHNA doptání najednou → jeden přepočet.
   *
   * Dřív se odpovídalo po jedné a každá odpověď smazala zbylé otázky — takže
   * u tří otázek šlo odpovědět jen na první. Teď se seberou všechny a odešlou
   * spolu.
   */
  async function submitAnswers(answers: Record<string, string>) {
    if (!result) return;
    const job: RoofJob = structuredClone(result.job);
    for (const [field, value] of Object.entries(answers)) {
      if (value.trim()) applyAnswer(job, field, value);
    }

    setPhase("thinking");
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job, summary: result.summary, profile: loadProfile() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setResult({ ...body, followUps: [] });
      setVersion((v) => v + 1);
      setShareUrl(null);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Nepodarilo sa prepočítať.");
    }
  }

  const busy = phase === "transcribing" || phase === "thinking";
  const active = result?.tiers.find((t) => t.id === tier) ?? result?.tiers[0];

  // Zákazník do karty: co vytáhla AI, doplněné o to, co už bylo na kontaktu.
  // Extrakce z mailu vyhrává (má čerstvé info), kontakt vyplní, co v mailu není.
  const customerInitial = useMemo<RoofJob["customer"]>(() => {
    const c = result?.job.customer ?? { name: null, obec: null, phone: null, email: null };
    if (!linkedCustomer) return c;
    return {
      name: c.name ?? linkedCustomer.name,
      obec: c.obec ?? linkedCustomer.obec,
      phone: c.phone ?? linkedCustomer.phone,
      email: c.email ?? linkedCustomer.email,
    };
  }, [result, linkedCustomer]);

  /**
   * Odeslání zákazníkovi.
   *
   * Data jsou roztroušená po třech komponentách (zákazník, obrázek, položky),
   * proto si je sem hlásí zpátky nahoru — jinak by tlačítko nemělo co poslat.
   */
  async function share() {
    if (!active || !live) return;
    if (videoUploading) {
      setError("Počkaj, video sa ešte nahráva.");
      return;
    }
    setSharing(true);
    try {
      const profile = loadProfile();
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: profile.company,
          customer,
          summary: result?.summary ?? "",
          tierName: active.name,
          productName: `${active.product.brand} ${active.product.model}`,
          earliestTerm: profile.earliestTerm,
          items: live.items,
          totals: live.totals,
          range: live.totals.range,
          assumptions: active.quote.assumptions,
          imageDataUrl,
          beforeImageUrl: gallery.before,
          variants: gallery.variants,
          tiles: gallery.tiles,
          // „Zeptej se manželky": pošleme všechny 3 úrovně na výběr.
          tiers:
            letChoose && result
              ? result.tiers.map((t) => ({
                  id: t.id,
                  name: t.name,
                  productName: `${t.product.brand} ${t.product.model}`,
                  range: t.quote.range,
                  totals: {
                    totalExVat: t.quote.totalExVat,
                    totalIncVat: t.quote.totalIncVat,
                  },
                  items: t.quote.items,
                }))
              : [],
          videoId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setShareUrl(body.url);

      // Zakázka spadne do CRM. Tady se z jednorázové nabídky stává vedená
      // zakázka — od téhle chvíle ji majster má v seznamu a může ji sledovat.
      // Technické parametry z nadiktované nabídky → předvyplní se do CRM,
      // ať je majster nemusí psát dvakrát (v detailu se dají doladit).
      const rj = result?.job;
      const details: JobDetails = {};
      const set = (k: string, v: string | number | null | undefined) => {
        if (v != null && v !== "") details[k] = v;
      };
      if (rj) {
        set("roofType", rj.roof.type);
        set("pitchDeg", rj.roof.pitchDeg);
        set("areaM2", rj.roof.areaM2);
        set("lengthM", rj.roof.lengthM);
        set("widthM", rj.roof.widthM);
        set("chimneys", rj.penetrations.chimneys);
        set("skylights", rj.penetrations.skylights);
        set(
          "productName",
          active
            ? `${active.product.brand} ${active.product.model}`
            : rj.product.brand
              ? `${rj.product.brand} ${rj.product.model ?? ""}`.trim()
              : null,
        );
        set("colour", rj.product.colour);
      }

      upsertJob({
        // id → nabídka se přilepí na existující kartu kontaktu, ne založí druhou.
        ...(linkedJobId ? { id: linkedJobId } : {}),
        customer,
        summary: result?.summary ?? "",
        priceExVat: live.totals.totalExVat,
        shareUrl: body.url,
        status: "ponuka",
        details,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodarilo sa vytvoriť odkaz.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <main className="min-h-screen text-neutral-900">
      <div className="mx-auto max-w-2xl px-5 py-6 sm:py-10">
        {/* Horní lišta: značka vlevo, navigace vpravo. */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
              <RoofMark />
            </div>
            <p className="text-sm font-medium text-neutral-500">{company}</p>
          </div>
          <nav className="flex shrink-0 items-center gap-1">
            <Link
              href="/prehlad"
              aria-label="Prehľad"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-card hover:text-neutral-900 hover:shadow-soft"
            >
              <GridIcon />
            </Link>
            <Link
              href="/zakazky"
              aria-label="Zákazky"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-card hover:text-neutral-900 hover:shadow-soft"
            >
              <ListIcon />
            </Link>
            <Link
              href="/profil"
              aria-label="Moja firma"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 transition hover:bg-card hover:text-neutral-900 hover:shadow-soft"
            >
              <GearIcon />
            </Link>
          </nav>
        </header>

        <h1 className="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">
          Rýchla ponuka strechy
        </h1>

        {/* Napojeno na kontakt z CRM — nabídka se po odeslání přilepí na jeho kartu. */}
        {linkedCustomer && (
          <div className="mt-6 flex items-center gap-2.5 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-brand-800">
            <span>👤</span>
            <p className="text-sm">
              Ponuka pre{" "}
              <span className="font-semibold">
                {linkedCustomer.name ?? linkedCustomer.phone ?? "kontakt"}
              </span>
              {linkedCustomer.obec ? ` · ${linkedCustomer.obec}` : ""}
            </p>
          </div>
        )}

        {/* --- Vstup --- */}
        {phase !== "done" && (
          <>
            <div className="mt-10 flex flex-col items-center sm:mt-14">
              <button
                onClick={phase === "recording" ? stopRecording : startRecording}
                disabled={busy}
                className={`flex h-32 w-32 items-center justify-center rounded-full text-white transition-all duration-200 disabled:opacity-40 ${
                  phase === "recording"
                    ? "scale-110 animate-pulse bg-red-500 shadow-xl shadow-red-500/30"
                    : "bg-brand-600 shadow-lift ring-8 ring-brand-500/10 hover:scale-105 hover:bg-brand-700"
                }`}
              >
                <MicIcon />
              </button>
              <p className="mt-6 text-center text-[15px] text-neutral-500">
                {phase === "recording"
                  ? "Počúvam… ťukni, keď skončíš"
                  : phase === "transcribing"
                    ? "Prepisujem…"
                    : phase === "thinking"
                      ? "Počítam ponuku…"
                      : "Ťukni a povedz, čo si videl na obhliadke"}
              </p>
            </div>

            {/* Šablony — „dělám pořád to samé". Ťuknutí načte text. */}
            {templates.length > 0 && (
              <div className="mt-8">
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-400">
                  Šablóny
                </p>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white py-1.5 pl-3.5 pr-1.5 text-sm"
                    >
                      <button onClick={() => setTranscript(t.transcript)} className="font-medium text-neutral-700">
                        {t.name}
                      </button>
                      <button
                        onClick={() => removeTemplate(t.id)}
                        aria-label={`Zmazať šablónu ${t.name}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-300 active:bg-neutral-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8">
              <p className="mb-2 text-sm text-neutral-500">
                …alebo napíš, čo si videl — <span className="text-neutral-700">alebo sem rovno prilep celý dopyt z mailu, aj s fotkami.</span>
              </p>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                onPaste={(e) => {
                  // Vloženie zo schránky (na kompe): text nechá byť, obrázky odchytí.
                  const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
                  if (imgs.length) setMailPhotos((p) => [...p, ...imgs]);
                }}
                placeholder="Napríklad: Bol som na obhliadke v Nitre. Sedlová strecha Bramac Tegalit, ~180 m², sklon 35°, dva komíny, tri strešné okná. Mení sa celá krytina aj latovanie.

Alebo prilep celý mail od zákazníka — appka z neho vytiahne meno, obec, telefón aj strechu. Fotky prilož nižšie."
                rows={5}
                className="w-full resize-none rounded-xl border border-neutral-200 p-4 text-base outline-none placeholder:text-neutral-400 focus:border-brand-500"
              />

              {/* Fotky z mailu — príloha alebo vloženie zo schránky. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium active:bg-neutral-100">
                  Priložiť fotky
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const imgs = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
                      if (imgs.length) setMailPhotos((p) => [...p, ...imgs]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {mailPhotos.map((f, n) => (
                  <div key={n} className="relative h-16 w-16 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(f)}
                      alt=""
                      className="h-16 w-16 rounded-lg border border-neutral-200 object-cover"
                    />
                    <button
                      onClick={() => setMailPhotos((p) => p.filter((_, i) => i !== n))}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-white"
                      aria-label="Odstrániť fotku"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => analyse(transcript)}
                  disabled={busy || transcript.trim().length < 10}
                  className="rounded-xl bg-brand-600 px-6 py-3 font-medium text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-30 disabled:shadow-none"
                >
                  Spracovať
                </button>
                {transcript.trim().length >= 10 && (
                  <button
                    onClick={saveCurrentAsTemplate}
                    className="text-sm text-neutral-500 underline underline-offset-4"
                  >
                    Uložiť ako šablónu
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* --- Výsledek --- */}
        {phase === "done" && result && (
          <div className="mt-8 space-y-6">
            <Card title="Rozumiem tomu takto">
              <p className="text-[15px] leading-relaxed">{result.summary}</p>
              <button
                onClick={() => {
                  setPhase("idle");
                  setResult(null);
                }}
                className="mt-4 text-sm text-neutral-500 underline underline-offset-4"
              >
                Začať odznova
              </button>
            </Card>

            {result.followUps.length > 0 && (
              <FollowUps followUps={result.followUps} onSubmit={submitAnswers} />
            )}

            <CustomerCard initial={customerInitial} onChange={setCustomer} />

            <TierPicker tiers={result.tiers} selected={tier} onSelect={setTier} />

            {/* Fotka i maska zůstávají, mění se jen taška. Přepnutí hladiny
                překreslí zákazníkův barák — a druhé přepnutí je z cache zdarma. */}
            {active && (
              <RoofPhoto
                productId={active.product.id}
                productName={active.product.model}
                onRendered={setImageDataUrl}
                onGallery={setGallery}
                initialPhoto={mailPhotos[0] ?? null}
              />
            )}

            {active && (
              <QuoteCard
                key={`${version}-${tier}`}
                quote={active.quote}
                onChange={(items, totals) => setLive({ items, totals })}
              />
            )}

            {/* Kontrola těsně před odesláním — přesně tam, kde na ni majster
                narazí, když chce poslat. */}
            {result && live && <QuoteCheck findings={checkQuote(result.job, live.items)} />}

            {/* Nákupní seznam do velkoobchodu — z materiálu nabídky. */}
            {live && <ShoppingList items={live.items} companyName={company} />}

            {/* Zákazkový list pro partu v jejím jazyce. */}
            {live && active && (
              <WorkOrder
                items={live.items}
                obec={customer.obec ?? result.job.customer.obec}
                summary={result.summary}
                warnings={active.quote.assumptions}
              />
            )}

            {/* Solár — kolik by střecha vyrobila (upsell + wow). */}
            <SolarEstimate
              obec={customer.obec ?? result.job.customer.obec}
              areaM2={
                result.job.roof.areaM2 ??
                (result.job.roof.lengthM && result.job.roof.widthM
                  ? result.job.roof.lengthM * result.job.roof.widthM
                  : null)
              }
              pitchDeg={result.job.roof.pitchDeg}
            />

            <VideoMessage
              onReady={(id) => {
                setVideoId(id);
                // Video přišlo/zmizelo AŽ po vytvoření nabídky → stará nabídka
                // ho neobsahuje. Zahodíme ji, ať se pošle znovu i s videem.
                setShareUrl(null);
              }}
              onUploading={setVideoUploading}
            />

            {/* „Zeptej se manželky" — nechat zákazníka vybrat z 3 úrovní. */}
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 p-4">
              <input
                type="checkbox"
                checked={letChoose}
                onChange={(e) => {
                  setLetChoose(e.target.checked);
                  setShareUrl(null); // změna → nabídka se musí vytvořit znovu
                }}
                className="mt-0.5 h-5 w-5"
              />
              <span>
                <span className="text-[15px] font-medium">Nechať zákazníka vybrať z 3 cien</span>
                <span className="mt-0.5 block text-sm text-neutral-500">
                  Zákazník (aj manželka) uvidí všetky tri úrovne a vyberie si — nerozhoduje
                  áno/nie, ale ktorú. Dáme ti vedieť, čo si vybral.
                </span>
              </span>
            </label>

            <ShareBar
              url={shareUrl}
              sharing={sharing}
              onShare={share}
              customerPhone={customer.phone}
              customerName={customer.name}
              companyName={company}
              hasVideo={!!videoId}
              tiers={letChoose ? result.tiers.map((t) => ({ id: t.id, name: t.name })) : undefined}
            />
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
      </div>
    </main>
  );
}

function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section
      className={`rounded-2xl border p-5 ${accent ? "border-brand-200 bg-brand-50" : "border-neutral-200/70 bg-card shadow-soft"}`}
    >
      <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Karta zákazníka — Modul 1 ze zadání klienta.
 *
 * Předvyplňuje se z toho, co majster nadiktoval. Když řekne "obhliadka
 * u pána Kováča v Nitre, telefón nula deväť...", je karta hotová a on ji jen
 * potvrdí. Co neřekl, dopíše prstem.
 */
function CustomerCard({
  initial,
  onChange,
}: {
  initial: RoofJob["customer"];
  onChange: (c: RoofJob["customer"]) => void;
}) {
  const [c, setC] = useState(initial);
  // Když AI vytáhne (nebo se změní) zákazníka, nasadíme ho do karty a rovnou
  // ohlásíme nahoru — jinak by "Poslať" odešel prázdného zákazníka, dokud by
  // majster ručně neťukl do políčka. `initial` je memoizovaný, takže to
  // nejede v kruhu.
  useEffect(() => {
    setC(initial);
    onChange(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const set = (k: keyof RoofJob["customer"]) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...c, [k]: e.target.value || null };
    setC(next);
    onChange(next);
  };

  const fromSpeech = (k: keyof RoofJob["customer"]) => initial[k] != null;

  return (
    <section className="rounded-2xl border border-neutral-200 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Zákazník</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            ["name", "Meno a priezvisko", "text"],
            ["obec", "Obec", "text"],
            ["phone", "Telefón", "tel"],
            ["email", "E-mail", "email"],
          ] as const
        ).map(([k, label, type]) => (
          <label key={k} className="block">
            <span className="flex items-center gap-2 text-xs text-neutral-400">
              {label}
              {fromSpeech(k) && (
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
                  z reči
                </span>
              )}
            </span>
            <input
              type={type}
              value={c[k] ?? ""}
              onChange={set(k)}
              placeholder={k === "name" ? "Ján Kováč" : k === "email" ? "jan@example.sk" : ""}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-brand-500"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {c.phone && (
          <a
            href={`tel:${c.phone}`}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Zavolať
          </a>
        )}
        {c.obec && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.obec)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Navigovať
          </a>
        )}
      </div>
    </section>
  );
}

/**
 * Tři hladiny vedle sebe.
 *
 * Toto je ten rozdiel medzi "chcete to?" a "ktorú chcete?". Zákazník, ktorý
 * vidí tri ceny, neporovnáva s konkurenciou — porovnáva medzi sebou.
 */
function TierPicker({
  tiers,
  selected,
  onSelect,
}: {
  tiers: TieredQuote[];
  selected: TierId;
  onSelect: (t: TierId) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-400">
        Krytina — vyber podľa vzhľadu (vidí len ty, prepíše sa do ceny aj vizualizácie)
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiers.map((t) => {
          const on = t.id === selected;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`relative overflow-hidden rounded-2xl border-2 text-left transition ${
                on
                  ? "border-brand-600 shadow-lift ring-2 ring-brand-500/20"
                  : "border-neutral-200 hover:border-neutral-300 hover:shadow-soft"
              }`}
            >
              {/* Fotka tašky — ať majster vybírá očima, nemusí znát názvy. */}
              <div className="relative aspect-[4/3] w-full bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.product.imageUrl}
                  alt={`${t.product.brand} ${t.product.model}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {on && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs text-white shadow-soft">
                    ✓
                  </span>
                )}
                {t.recommended && (
                  <span className="absolute left-2 top-2 rounded-full bg-neutral-900/85 px-2 py-0.5 text-[10px] font-semibold text-white">
                    ODPORÚČAME
                  </span>
                )}
              </div>

              <div className="p-4">
                <p className="text-xs uppercase tracking-widest text-neutral-400">{t.name}</p>
                <p className="mt-0.5 text-sm font-medium">
                  {t.product.brand} {t.product.model}
                  {t.asDictated && <span className="ml-1 text-xs font-normal text-neutral-400">· povedal si</span>}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                  {eur(t.quote.totalExVat)}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-neutral-500">{t.pitch}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const BADGE = {
  computed: { text: "spočítané", cls: "bg-green-100 text-green-800" },
  estimated: { text: "odhad", cls: "bg-amber-100 text-amber-800" },
  manual: { text: "tvoje", cls: "bg-neutral-100 text-neutral-600" },
};

/**
 * Nabídka. Všechno v ní jde přepsat.
 *
 * Bez toho jsou štítky "odhad, skontroluj" prázdné gesto — apka řekne
 * zkontroluj a nedá jak. Majster přepíše dva řádky a jde od toho.
 * Přepočet je lokální, žádné kolečko na server: stojí na střeše.
 */
/** Časté střešní doplňky pro upsell. Množství a cenu doplní majster. */
const ACCESSORIES: { label: string; unit: string }[] = [
  { label: "Snehové zábrany", unit: "bm" },
  { label: "Odkvapový žľab", unit: "bm" },
  { label: "Zvody (odpadové rúry)", unit: "ks" },
  { label: "Poistná hydroizolačná fólia", unit: "m²" },
  { label: "Vetrací pás hrebeňa", unit: "bm" },
  { label: "Záveterná lišta", unit: "bm" },
];

function QuoteCard({
  quote,
  onChange,
}: {
  quote: Quote;
  onChange?: (items: PricedItem[], totals: ReturnType<typeof recomputeTotals>) => void;
}) {
  const [items, setItems] = useState<PricedItem[]>(quote.items);
  const [marginPct, setMarginPct] = useState(15);
  const [vatPct] = useState(23);

  const totals = recomputeTotals(items, { marginPct, vatPct });

  // Rodič potřebuje aktuální položky pro odkaz zákazníkovi. Effect, ne volání
  // v těle — jinak setState v rodiči během renderu dítěte spadne.
  useEffect(() => onChange?.(items, totals), [items, marginPct]);

  const patch = (n: number, qty: number | null, unitPrice: number | null) =>
    setItems((prev) => prev.map((it, i) => (i === n ? repriceItem(it, qty, unitPrice) : it)));

  const remove = (n: number) => setItems((prev) => prev.filter((_, i) => i !== n));

  const add = (kind: "material" | "praca") =>
    setItems((prev) => [
      ...prev,
      {
        label: "Nová položka",
        qty: 1,
        unit: kind === "praca" ? "hod" : "ks",
        unitPrice: 0,
        total: 0,
        confidence: "manual",
        priceIsPlaceholder: false,
        note: null,
        kind,
      },
    ]);

  // Upsell: časté doplňky na jeden ťuk. Vyšší košík bez diktovania. Množství
  // a cenu doplní majster — nic si nevymýšlíme. Přidá se jen když tam ještě není.
  const addAccessory = (label: string, unit: string) =>
    setItems((prev) =>
      prev.some((i) => i.label === label)
        ? prev
        : [
            ...prev,
            {
              label,
              qty: null,
              unit,
              unitPrice: null,
              total: null,
              confidence: "manual",
              priceIsPlaceholder: true,
              note: "Doplnok — doplň množstvo a cenu.",
              kind: "material",
            },
          ],
    );

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200">
      <div className="bg-neutral-900 p-6 text-white">
        <p className="text-xs uppercase tracking-widest text-neutral-400">Orientačná cena</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">
          {eur(totals.range.from)} – {eur(totals.range.to)}
        </p>
        <p className="mt-1 text-sm text-neutral-400">bez DPH · {eur(totals.totalIncVat)} s DPH</p>
      </div>

      <div className="divide-y divide-neutral-100">
        {(["material", "praca"] as const).map((kind) => (
          <div key={kind} className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              {kind === "material" ? "Materiál" : "Práca"}
            </p>
            <div className="space-y-4">
              {/* Mobil first: 98 % provozu je telefon, takže položka je blok
                  na tři řádky, ne tabulka. Sedm prvků vedle sebe se na 375px
                  displeji nevejde a nikdo je neťukne. */}
              {items.map((it, n) =>
                it.kind !== kind ? null : (
                  <div key={n} className="rounded-xl border border-neutral-100 p-3">
                    <input
                      value={it.label}
                      onChange={(e) =>
                        setItems((p) => p.map((x, i) => (i === n ? { ...x, label: e.target.value } : x)))
                      }
                      className="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 text-base focus:border-brand-500 focus:outline-none"
                    />

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 px-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${BADGE[it.confidence].cls}`}>
                        {BADGE[it.confidence].text}
                      </span>
                      {it.note && <span className="text-xs leading-snug text-neutral-400">{it.note}</span>}
                    </div>

                    <div className="mt-2.5 flex items-center gap-2">
                      <Num value={it.qty} onChange={(v) => patch(n, v, it.unitPrice)} w="w-20" />
                      <span className="w-7 text-sm text-neutral-400">{it.unit}</span>
                      <span className="text-neutral-300">×</span>
                      <Num value={it.unitPrice} onChange={(v) => patch(n, it.qty, v)} w="w-20" suffix="€" />
                      <span className="ml-auto text-[15px] font-semibold tabular-nums">{eur(it.total)}</span>
                      {/* Na telefonu není hover — mazání musí být vidět vždycky.
                          44px je minimální cíl, na který se dá trefit prstem. */}
                      <button
                        onClick={() => remove(n)}
                        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-xl text-neutral-300 active:text-red-500"
                        aria-label={`Zmazať ${it.label}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ),
              )}
              <button
                onClick={() => add(kind)}
                className="text-sm text-neutral-400 hover:text-neutral-900"
              >
                + pridať položku
              </button>

              {/* Doplnky na jeden ťuk — jen u materiálu. Vyšší košík. */}
              {kind === "material" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACCESSORIES.filter((a) => !items.some((i) => i.label === a.label)).map((a) => (
                    <button
                      key={a.label}
                      onClick={() => addAccessory(a.label, a.unit)}
                      className="rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-500 active:bg-neutral-100"
                    >
                      + {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="space-y-2 bg-neutral-50 p-5 text-sm">
          <Row label="Materiál" value={eur(totals.materialTotal)} />
          <Row label="Práca" value={eur(totals.labourTotal)} />
          <div className="flex items-center justify-between text-neutral-500">
            <span className="flex items-center gap-2">
              Zisk
              <Num value={marginPct} onChange={(v) => setMarginPct(v ?? 0)} w="w-12" suffix="%" />
            </span>
            <span className="tabular-nums">{eur(totals.margin)}</span>
          </div>
          <Row label="Spolu bez DPH" value={eur(totals.totalExVat)} strong />
        </div>
      </div>

      {quote.assumptions.length > 0 && (
        <div className="border-t border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Predpoklady</p>
          <ul className="mt-2 space-y-1">
            {quote.assumptions.map((a, n) => (
              <li key={n} className="text-xs text-amber-900">
                • {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * Číselné pole.
 *
 * - prázdné = null, ne nula. Nula je cena, prázdno je "nevím".
 * - inputMode="decimal" vytáhne na telefonu číselnou klávesnici, ne písmenkovou.
 * - text-base (16px) je záměr: pod 16px iOS při ťuknutí do inputu sám zoomne
 *   stránku a majster pak kouká na rozšmudlanou nabídku.
 * - py-2 dává výšku ~44px — na to se dá trefit prstem v rukavici.
 */
function Num({
  value,
  onChange,
  w,
  suffix,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  w: string;
  suffix?: string;
}) {
  return (
    <span className="relative inline-flex items-center">
      <input
        inputMode="decimal"
        value={value ?? ""}
        onChange={(e) => {
          const t = e.target.value.replace(",", ".").trim();
          if (t === "") return onChange(null);
          const n = parseFloat(t);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={`${w} rounded-lg border border-neutral-200 px-2 py-2 text-right text-base tabular-nums focus:border-brand-500 focus:outline-none`}
      />
      {suffix && <span className="ml-1 text-sm text-neutral-400">{suffix}</span>}
    </span>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "pt-2 font-semibold" : "text-neutral-500"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3" strokeLinecap="round" />
    </svg>
  );
}

function RoofMark() {
  // Střecha domu — značka appky.
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/**
 * Odeslání zákazníkovi — odkaz místo PDF.
 *
 * Rozdíl je celý smysl: zákazník uvidí fotku svého baráku s novou střechou,
 * ne tabulku v příloze. Řemeslník uvidí, kdy si to otevřel. A dá se to
 * aktualizovat bez posílání druhého mailu.
 *
 * Sdílení jede přes nativní share sheet telefonu — majster to hodí do
 * WhatsAppu nebo SMS podle toho, kde s tím zákazníkem mluví.
 */
/**
 * Telefon do mezinárodního formátu pro wa.me (bez +, bez mezer, s předvolbou).
 * Majster nadiktuje "0921...", WhatsApp chce "421921...".
 */
function waNumber(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return "421" + digits.slice(1); // SK předvolba
  return digits;
}

function ShareBar({
  url,
  sharing,
  onShare,
  customerPhone,
  customerName,
  companyName,
  hasVideo,
  tiers,
}: {
  url: string | null;
  sharing: boolean;
  onShare: () => void;
  customerPhone: string | null;
  customerName: string | null;
  companyName: string;
  hasVideo: boolean;
  /** Úrovně, když je poslal na výběr — pro zobrazení názvu vybrané. */
  tiers?: { id: string; name: string }[];
}) {
  const [copied, setCopied] = useState(false);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [interestedAt, setInterestedAt] = useState<string | null>(null);
  const [chosenTier, setChosenTier] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const id = url?.split("/p/")[1] ?? null;
  const chosenName = tiers?.find((t) => t.id === chosenTier)?.name ?? null;

  // Předvyplněná zpráva, kterou zákazník uvidí ve WhatsAppe/SMS.
  const greeting = customerName ? `Dobrý deň ${customerName.split(" ")[0]}` : "Dobrý deň";
  const message = url
    ? `${greeting}, posielam Vám cenovú ponuku na strechu: ${url}\n\n${companyName}`
    : "";
  const wa = customerPhone ? waNumber(customerPhone) : null;

  /**
   * Dotazujeme se, jestli si zákazník nabídku otevřel.
   *
   * Ptáme se jen dokud neotevře — pak nemá smysl zatěžovat server dál.
   * Až budou push notifikace, tohle zmizí a majstrovi to přijde do kapsy
   * i se zavřenou appkou. Zatím to funguje, jen musí mít obrazovku otevřenou.
   */
  useEffect(() => {
    // Ptáme se dál až do podpisu — to je finální stav. Cestou zachytíme
    // otevření, zájem i výběr úrovně.
    if (!id || signedAt) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/share/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        if (body.openedAt) setOpenedAt(body.openedAt);
        if (body.interestedAt) setInterestedAt(body.interestedAt);
        if (body.chosenTier) setChosenTier(body.chosenTier);
        if (body.signedAt) setSignedAt(body.signedAt);
      } catch {
        // Výpadek sítě na střeše — zkusíme to za tři vteřiny znovu.
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [id, signedAt]);

  if (!url) {
    return (
      <button
        onClick={onShare}
        disabled={sharing}
        className="w-full rounded-xl bg-brand-600 py-4 text-base font-medium text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-40 disabled:shadow-none active:opacity-90"
      >
        {sharing ? "Pripravujem…" : "Poslať zákazníkovi"}
      </button>
    );
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url!);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Některé prohlížeče blokují clipboard bez gesta — nativní share jako záloha.
      if (navigator.share) await navigator.share({ url: url! }).catch(() => {});
    }
  }

  return (
    <div className="space-y-3">
      {/* Podpis je vrchol — závazná objednávka. Nejsilnější banner. */}
      {signedAt && (
        <div className="rounded-2xl border-2 border-green-700 bg-green-700 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-white">
            ✍️ Zákazník podpísal!
          </p>
          <p className="mt-2 text-[15px] leading-relaxed">
            Závazne objednal{chosenName ? ` (${chosenName})` : ""}. Ozvi sa a dohodni termín.
          </p>
          <p className="mt-1 text-xs text-green-100">{new Date(signedAt).toLocaleString("sk-SK")}</p>
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="mt-4 flex items-center justify-center rounded-xl bg-white py-3 text-base font-semibold text-green-700 active:opacity-80"
            >
              Zavolať {customerName ? customerName.split(" ")[0] : "zákazníkovi"}
            </a>
          )}
        </div>
      )}

      {/* Výběr úrovně — zákazník řekl KTOROU. Silnější než pouhý zájem. */}
      {chosenTier && !signedAt && (
        <div className="rounded-2xl border-2 border-green-600 bg-green-600 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-white">
            🔥 Zákazník si vybral{chosenName ? `: ${chosenName}` : ""}!
          </p>
          <p className="mt-2 text-[15px] leading-relaxed">
            Rozhodol sa pre úroveň. Zavolaj mu teraz, dokým je rozhodnutý.
          </p>
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="mt-4 flex items-center justify-center rounded-xl bg-white py-3 text-base font-semibold text-green-700 active:opacity-80"
            >
              Zavolať {customerName ? customerName.split(" ")[0] : "zákazníkovi"}
            </a>
          )}
        </div>
      )}

      {/* Zájem je silnější událost než otevření — vlastní, výraznější banner.
          Když přišel výběr/podpis, tenhle už neukazujeme, ať je signál čistý. */}
      {interestedAt && !chosenTier && !signedAt && (
        <div className="rounded-2xl border-2 border-green-600 bg-green-600 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-white">
            🔥 Zákazník má záujem!
          </p>
          <p className="mt-2 text-[15px] leading-relaxed">
            Práve ťukol „Mám záujem". Zavolaj mu teraz, dokým je rozhodnutý — toto
            je tá chvíľa.
          </p>
          <p className="mt-1 text-xs text-green-100">
            {new Date(interestedAt).toLocaleString("sk-SK")}
          </p>
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="mt-4 flex items-center justify-center rounded-xl bg-white py-3 text-base font-semibold text-green-700 active:opacity-80"
            >
              Zavolať {customerName ? customerName.split(" ")[0] : "zákazníkovi"}
            </a>
          )}
        </div>
      )}

      {/* "Zákazník si otvoril" se přidá NAD tlačítka, ne místo nich — ať jde
          nabídku poslat znova (třeba přes iný kanál, keď na prvé neodpovedal). */}
      {openedAt && !interestedAt && !chosenTier && !signedAt && (
        <div className="rounded-2xl border-2 border-neutral-900 bg-neutral-900 p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-green-400">
            Zákazník si ponuku otvoril
          </p>
          <p className="mt-2 text-[15px] leading-relaxed">
            Práve sa na ňu pozerá. Toto je najlepší moment zdvihnúť telefón.
          </p>
          <p className="mt-1 text-xs text-neutral-400">{new Date(openedAt).toLocaleString("sk-SK")}</p>
        </div>
      )}

      <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-green-700">
          {openedAt ? "Poslať znova" : "Ponuka je pripravená"}
        </p>
        {/* Co všechno je v odkazu — ať majster v momente odoslania vie,
            čo posiela. Video je práve tá vec, ktorá sa ľahko zabudne. */}
        <p className="mt-1 text-xs text-green-800">
          Obsahuje: vizualizáciu, položky{hasVideo ? ", videopozdrav ✓" : " (bez videa)"}
        </p>
        <p className="mt-2 text-sm text-green-800">Pošli zákazníkovi odkaz na ponuku:</p>

      {/* Hlavní cesta ven: WhatsApp, pak SMS. Otevřou se s předvyplněnou
          zprávou i odkazem — majster len odošle. */}
      <div className="mt-4 space-y-2">
        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-base font-semibold text-white active:opacity-80"
          >
            <WhatsAppIcon /> Poslať cez WhatsApp
          </a>
        )}
        {customerPhone && (
          <a
            href={`sms:${customerPhone}?&body=${encodeURIComponent(message)}`}
            className="flex items-center justify-center rounded-xl border border-neutral-300 bg-white py-3.5 text-base font-medium active:bg-neutral-100"
          >
            Poslať cez SMS
          </a>
        )}
      </div>

      {/* Odkaz + kopírovat pro případ, že chce poslat jinudy (mail, Messenger…). */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-green-200 bg-white p-2">
        <span className="min-w-0 flex-1 truncate pl-2 text-sm text-neutral-500">{url}</span>
        <button
          onClick={copyLink}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          {copied ? "Skopírované ✓" : "Kopírovať"}
        </button>
      </div>

      <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-green-800 underline underline-offset-4">
        Pozrieť, ako to vidí zákazník
      </a>

        {!customerPhone && (
          <p className="mt-3 text-xs text-neutral-500">
            Tip: doplň zákazníkovi telefón a objaví sa tu tlačidlo na WhatsApp.
          </p>
        )}
      </div>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 14.4c-.3-.15-1.7-.84-1.96-.93-.26-.1-.45-.15-.64.15-.19.29-.74.93-.9 1.12-.17.19-.33.22-.62.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.64-1.55-.88-2.12-.23-.56-.47-.48-.64-.49-.17-.01-.36-.01-.55-.01-.19 0-.51.07-.77.36-.26.29-1.01.99-1.01 2.41 0 1.42 1.04 2.8 1.18 2.99.15.19 2.05 3.13 4.96 4.39.69.3 1.23.48 1.65.61.69.22 1.32.19 1.82.11.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34zM12.05 21.5h-.01a9.5 9.5 0 01-4.83-1.32l-.35-.21-3.59.94.96-3.5-.23-.36a9.45 9.45 0 01-1.45-5.05c0-5.24 4.27-9.5 9.51-9.5 2.54 0 4.93.99 6.72 2.79a9.44 9.44 0 012.78 6.72c0 5.24-4.27 9.5-9.5 9.5zm5.53-15.02A11.36 11.36 0 0012.05.99C5.78.99.68 6.09.68 12.36c0 2 .52 3.95 1.51 5.67L.59 24l6.11-1.6a11.34 11.34 0 005.35 1.36h.01c6.27 0 11.37-5.1 11.37-11.37 0-3.04-1.18-5.89-3.33-8.04z" />
    </svg>
  );
}

/**
 * Kontrola nabídky před odesláním. #42.
 *
 * Chyba = něco chybí a majster na tom prodělá (komín bez oplechování).
 * Upozornění = možná zapomněl, ale může to být záměr (bez fólie).
 *
 * Když je všechno v pořádku, ukáže zelené "vypadá to kompletně" — ta pochvala
 * má cenu, protože dá majstrovi jistotu poslat to hned, bez zpětného
 * přepočítávání v hlavě.
 */
function QuoteCheck({ findings }: { findings: CheckFinding[] }) {
  const errors = findings.filter((f) => f.severity === "chyba");
  const warns = findings.filter((f) => f.severity === "upozornenie");

  if (findings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
        <span className="text-green-600">✓</span>
        <span className="text-sm text-green-800">Ponuka vyzerá kompletne.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {errors.map((f, n) => (
        <div key={`e${n}`} className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
          <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
          <span className="text-[15px] leading-snug text-amber-900">{f.message}</span>
        </div>
      ))}
      {warns.map((f, n) => (
        <div key={`w${n}`} className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4">
          <span className="mt-0.5 shrink-0 text-neutral-400">?</span>
          <span className="text-[15px] leading-snug text-neutral-600">{f.message}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Zapíše odpověď na doptání do zakázky podle typu pole.
 *
 * Tři případy, každý jinak:
 *   - "scope"           → seznam. Vyparsujeme z odpovědi klíčová slova
 *                         ("aj latovanie a fólia" → přidá latovanie i fóliu).
 *   - "roof.pitchDeg"   → číslo. "35°" i "35 stupňov" → 35.
 *   - "product.model"   → text. "Tegalit" se zapíše, jak je.
 *
 * Dřív to padalo na scope, protože se do seznamu zapisovalo přes [undefined].
 */
function applyAnswer(job: RoofJob, field: string, value: string): void {
  if (field === "scope") {
    const found = SCOPE_ITEMS.filter((s) => value.toLowerCase().includes(s.toLowerCase()));
    // Když nic nerozpoznáme, aspoň krytina — o té se skoro vždycky mluví.
    const add: ScopeItem[] = found.length ? found : ["krytina"];
    job.scope = Array.from(new Set([...job.scope, ...add]));
    return;
  }

  const [group, key] = field.split(".") as [keyof RoofJob, string];
  if (!key) return;
  const num = parseFloat(value.replace(",", ".").replace(/[^\d.,-]/g, ""));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (job[group] as any)[key] = Number.isFinite(num) && /\d/.test(value) ? num : value.trim();
}

/**
 * Doptání. #ze zadání: "Ak niektorý údaj chýba, položí doplňujúcu otázku."
 *
 * Klíčová oprava: KAŽDÁ otázka má textové pole, ne jen tlačítka. Tlačítka jsou
 * jen rychlá volba (sklon 35/40/45). Když model nabídne volby, ťukneš; když ne
 * (jméno modelu, rozsah prací), napíšeš. Dřív otázka bez tlačítek byla slepá
 * ulička — nešlo na ni odpovědět vůbec.
 *
 * A odpovídá se na VŠECHNY najednou — jeden přepočet, ne smazání zbylých otázek.
 */
function FollowUps({
  followUps,
  onSubmit,
}: {
  followUps: FollowUp[];
  onSubmit: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const set = (field: string, value: string) => setAnswers((a) => ({ ...a, [field]: value }));

  const allAnswered = followUps.every((f) => answers[f.field]?.trim());

  return (
    <div className="rounded-2xl border border-neutral-900 bg-neutral-50 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        {followUps.length > 1 ? "Ešte pár vecí" : "Ešte jedna vec"}
      </h2>

      <div className="mt-4 space-y-5">
        {followUps.map((f) => (
          <div key={f.field}>
            <p className="text-[15px]">{f.question}</p>

            {/* Rychlá volba — ťuknutí vyplní pole. */}
            {f.options && f.options.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {f.options.map((o) => (
                  <button
                    key={o}
                    onClick={() => set(f.field, o)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium ${
                      answers[f.field] === o
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-neutral-300 active:bg-neutral-100"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}

            {/* Textové pole — vždycky. Tohle je ta oprava. */}
            <input
              value={answers[f.field] ?? ""}
              onChange={(e) => set(f.field, e.target.value)}
              placeholder="…alebo napíš odpoveď"
              className="mt-2 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-500"
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => onSubmit(answers)}
        disabled={!allAnswered}
        className="mt-5 w-full rounded-xl bg-brand-600 py-3.5 text-base font-medium text-white shadow-soft transition hover:bg-brand-700 disabled:opacity-30 disabled:shadow-none active:opacity-90"
      >
        Doplniť a prepočítať
      </button>
      {!allAnswered && (
        <p className="mt-2 text-center text-xs text-neutral-400">Odpovedz na všetky otázky</p>
      )}
    </div>
  );
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
