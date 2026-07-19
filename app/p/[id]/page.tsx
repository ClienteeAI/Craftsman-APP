import { notFound } from "next/navigation";
import { getQuote, markOpened } from "@/lib/quote/store";
import { notifyQuoteOwner } from "@/lib/push/send";
import { getVideoSource } from "@/lib/quote/video-store";
import InterestButtons from "./interest-buttons";
import OfferVisual from "./offer-visual";
import TierVote from "./tier-vote";
import SignOffer from "./sign-offer";
import MasterVideo from "./master-video";
import Reveal from "./reveal";
import ShareOffer from "./share-offer";

/**
 * Nabídka pro zákazníka. Odkaz místo PDF.
 *
 * Rozdíl proti PDF v příloze je celý smysl:
 *   - nahoře je fotka JEHO baráku s novou střechou, ne katalogový render
 *   - řemeslník vidí, kdy si ji zákazník otevřel, a může zavolat
 *   - jde aktualizovat bez posílání druhého mailu
 *   - na telefonu se otevře na jedno ťuknutí, nestahuje se
 */

export const dynamic = "force-dynamic";

const eur = (n: number) =>
  new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const dni = (n: number) => (n === 1 ? "deň" : n < 5 ? "dni" : "dní");

/**
 * Orientační délka realizace z plochy střechy (položka práce v m²). Parta
 * zvládne ~35–55 m²/den; demontáž staré krytiny přidá den. Vědomě „+-".
 */
function estimateDuration(items: { kind: string; unit: string; qty: number | null; label: string }[]): string | null {
  const areaItem = items.find((i) => i.kind === "praca" && i.unit === "m²");
  const area = typeof areaItem?.qty === "number" ? areaItem.qty : null;
  if (!area || area <= 0) return null;
  const extra = items.some((i) => /demont/i.test(i.label)) ? 1 : 0;
  const low = Math.max(1, Math.ceil(area / 55) + extra);
  const high = Math.max(low, Math.ceil(area / 35) + extra);
  return low === high ? `približne ${low} ${dni(low)}` : `približne ${low}–${high} dní`;
}

export default async function PublicQuote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await getQuote(id);
  if (!q) notFound();

  // Zaznamená první otevření. Řemeslník pak ví, kdy zvednout telefon.
  // Push jen při prvním otevření — ať nechodí při každém načtení stránky.
  const firstOpen = await markOpened(id);
  if (firstOpen) {
    await notifyQuoteOwner(id, {
      title: "Zákazník otvoril ponuku",
      body: `${q.customer.name ?? "Zákazník"} sa práve pozerá na ponuku.`,
      url: "/zakazky",
      tag: `opened-${id}`,
    });
  }

  const duration = estimateDuration(q.items);

  // Priamy (podpísaný) odkaz na video — spoľahlivejší pre <video> než 302 cez
  // /api/video/[id] (Safari na iPhone). Fallback na endpoint (demo bez Supabase).
  let videoUrl: string | null = null;
  if (q.videoId) {
    const vs = await getVideoSource(q.videoId);
    videoUrl = vs?.kind === "redirect" ? vs.url : `/api/video/${q.videoId}`;
  }

  return (
    <main className="min-h-screen text-neutral-900">
      <div className="mx-auto max-w-2xl px-5 py-8 pb-28">
        {/* Hlavička z profilu realizátora — jeho logo, jeho firma. */}
        <header className="flex items-center gap-3">
          {q.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.company.logoUrl} alt={q.company.name} className="h-10 w-auto" />
          ) : (
            <span className="font-semibold">{q.company.name}</span>
          )}
        </header>

        {/* Videopozdrav majstra ako kruh — tvár človeka je najsilnejší prvý dojem. */}
        {videoUrl && <MasterVideo src={videoUrl} />}

        <h1
          className="mt-8 text-[2rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl"
          style={{ animation: "fadeInUp 0.5s ease both" }}
        >
          {q.customer.name ? `${q.customer.name.split(" ")[0]}, takto` : "Takto"} by mohla vyzerať
          vaša strecha
        </h1>

        {/* Vizualizace jeho baráku — interaktivní: posuvník před/po + přepínač
            atmosféry. Tohle je ten rozdíl proti tabulce v PDF. */}
        {q.imageDataUrl && (
          <OfferVisual
            before={q.beforeImageUrl}
            afterDefault={q.imageDataUrl}
            variants={q.variants}
          />
        )}

        <Reveal>
        {q.tiers.length > 0 ? (
          <>
            <TierVote id={q.id} tiers={q.tiers} initialChosen={q.chosenTier} />
            {q.earliestTerm && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-neutral-200/70 bg-card shadow-soft p-5">
                <span className="text-neutral-400">📅</span>
                <span className="text-[15px]">
                  Najbližší voľný termín: <span className="font-medium">{q.earliestTerm}</span>
                </span>
              </div>
            )}
          </>
        ) : (
          <section className="mt-6 overflow-hidden rounded-2xl border border-neutral-200/70 bg-card shadow-soft">
            <div className="border-l-4 border-brand-500 p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Orientačná cena</p>
              <p className="mt-1 text-[2.6rem] font-semibold leading-none tracking-tight text-neutral-900 sm:text-5xl">
                {eur(q.range.from)}
                <span className="text-neutral-400"> – </span>
                {eur(q.range.to)}
              </p>
              <p className="mt-2 text-sm text-neutral-500">
                bez DPH · <span className="font-medium text-neutral-700">{eur(q.totals.totalIncVat)}</span> s DPH
              </p>
            </div>
            <div className="px-6 pb-6">
              <p className="text-[15px] leading-relaxed text-neutral-600">
                {q.tierName} — {q.productName}
              </p>
              {q.earliestTerm && (
                <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-4">
                  <span className="text-neutral-400">📅</span>
                  <span className="text-[15px]">
                    Najbližší voľný termín:{" "}
                    <span className="font-medium">{q.earliestTerm}</span>
                  </span>
                </div>
              )}
            </div>
          </section>
        )}
        </Reveal>

        {/* Solárny upsell — keď ho majster pridal. Silný dôvod dokúpiť FV. */}
        {q.solar && (
          <Reveal className="mt-4 block overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-soft">
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
                ☀️ Solár na túto strechu
              </p>
              <p className="mt-1 text-[2.2rem] font-semibold leading-none tracking-tight text-neutral-900 sm:text-4xl">
                ≈ {q.solar.annualKwh.toLocaleString("sk-SK")} kWh<span className="text-lg text-neutral-500"> / rok</span>
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
                Elektráreň ≈ {q.solar.kWp} kWp na ≈ {q.solar.usableAreaM2} m² využiteľnej plochy. Ušetrí zhruba{" "}
                <span className="font-semibold">{q.solar.savingsEur.toLocaleString("sk-SK")} € ročne</span>.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                Orientačný odhad z dát PVGIS (Európska komisia). Najlepší čas riešiť je teraz, keď je strecha aj tak hore.
              </p>
            </div>
          </Reveal>
        )}

        {/* Rozhodujú sa spolu — pošli ponuku blízkym (manželke). */}
        <Reveal>
          <ShareOffer name={q.customer.name} />
        </Reveal>

        {/* Odhad dĺžky realizácie — zákazník chce vedieť, „ako dlho to bude trvať". */}
        {duration && (
          <Reveal className="mt-4 flex items-center gap-2.5 rounded-2xl border border-neutral-200/70 bg-card p-5 shadow-soft">
            <span className="text-neutral-400">⏱️</span>
            <span className="text-[15px]">
              Realizácia trvá <span className="font-medium">{duration}</span>{" "}
              <span className="text-neutral-400">(orientačne, upresní sa po zameraní)</span>
            </span>
          </Reveal>
        )}

        <Reveal className="mt-4 block overflow-hidden rounded-2xl border border-neutral-200/70 bg-card shadow-soft">
          <div className="border-b border-neutral-100 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Čo je v cene
            </p>
          </div>
          {(["material", "praca"] as const).map((kind) => (
            <div key={kind} className="border-b border-neutral-100 p-5 last:border-0">
              <p className="mb-3 text-xs uppercase tracking-widest text-neutral-400">
                {kind === "material" ? "Materiál" : "Práca"}
              </p>
              <div className="space-y-2.5">
                {q.items
                  .filter((i) => i.kind === kind)
                  .map((i, n) => (
                    <div key={n} className="flex items-baseline justify-between gap-3 text-[15px]">
                      <span className="min-w-0 flex-1">{i.label}</span>
                      <span className="shrink-0 whitespace-nowrap text-sm text-neutral-400">
                        {i.qty} {i.unit}
                      </span>
                      <span className="w-20 shrink-0 text-right font-medium tabular-nums">
                        {i.total != null ? eur(i.total) : "—"}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          <div className="space-y-1.5 bg-neutral-50 p-5 text-sm">
            <div className="flex justify-between text-neutral-500">
              <span>Materiál</span>
              <span className="tabular-nums">{eur(q.totals.materialTotal)}</span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>Práca</span>
              <span className="tabular-nums">{eur(q.totals.labourTotal)}</span>
            </div>
            <div className="flex justify-between pt-2 font-semibold">
              <span>Spolu bez DPH</span>
              <span className="tabular-nums">{eur(q.totals.totalExVat)}</span>
            </div>
          </div>
        </Reveal>

        {/* Poctivost prodává. Zákazník, který vidí, co je odhad, věří zbytku. */}
        <p className="mt-5 text-xs leading-relaxed text-neutral-400">
          Toto je rýchly orientačný odhad, nie realizačný rozpočet. Presná cena sa upresní po
          zameraní strechy.
          {q.assumptions.length > 0 && (
            <>
              {" "}
              Vychádzali sme z týchto predpokladov: {q.assumptions.join(" ")}
            </>
          )}
        </p>

        {/* Závazný podpis přímo v odkazu — z týdnů na hodinu. */}
        <SignOffer id={q.id} initialSigned={q.signedAt != null} />
      </div>

      {/* Pod palcem. Zákazník to čte na telefonu. Ťuknutí zároveň dá majstrovi
          vědět, že má zákazník záujem — vidí to hneď na svojej obrazovke. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur">
        <InterestButtons
          id={q.id}
          phone={q.company.phone}
          email={q.company.email}
          subject={`Ponuka strechy ${q.id}`}
        />
      </div>
    </main>
  );
}
