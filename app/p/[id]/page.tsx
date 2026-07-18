import { notFound } from "next/navigation";
import { getQuote, markOpened } from "@/lib/quote/store";
import InterestButtons from "./interest-buttons";

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

export default async function PublicQuote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = getQuote(id);
  if (!q) notFound();

  // Zaznamená první otevření. Řemeslník pak ví, kdy zvednout telefon.
  markOpened(id);

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
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

        <h1 className="mt-8 text-3xl font-semibold leading-tight tracking-tight">
          {q.customer.name ? `${q.customer.name.split(" ")[0]}, takto` : "Takto"} by mohla vyzerať
          vaša strecha
        </h1>

        {/* Video pozdrav majstra. Načítá se z /api/video/[id] s Range podporou —
            preto ho prehliadač (aj Safari) prehrá. Nad vizualizaci: tvár človeka
            je silnejší prvý dojem než render. */}
        {q.videoId && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={`/api/video/${q.videoId}`}
            controls
            playsInline
            preload="metadata"
            className="mt-6 w-full rounded-2xl bg-black"
          />
        )}

        {/* Fotka jeho baráku. Tohle je ten rozdíl proti tabulce v PDF. */}
        {q.imageDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={q.imageDataUrl}
            alt="Vizualizácia vašej strechy"
            className="mt-6 w-full rounded-2xl border border-neutral-200"
          />
        )}

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="text-xs uppercase tracking-widest text-neutral-400">Orientačná cena</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">
            {eur(q.range.from)} – {eur(q.range.to)}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            bez DPH · {eur(q.totals.totalIncVat)} s DPH
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-600">
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
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
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
        </section>

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
      </div>

      {/* Pod palcem. Zákazník to čte na telefonu. Ťuknutí zároveň dá majstrovi
          vědět, že má zákazník záujem — vidí to hneď na svojej obrazovke. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
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
