import { priceQuote, type Quote } from "./pricing";
import { PRODUCTS, type RoofProduct } from "./products";
import type { CraftsmanProfile } from "./profile";
import { computeTakeoff } from "./takeoff";
import type { RoofJob, ScopeItem } from "./types";

/**
 * Tři cenové hladiny.
 *
 * V zadání klienta tohle NENÍ. Je to jedna z mála věcí, kde jdu nad rámec,
 * protože je to nejlevnější způsob, jak majstrovi zvednout tržbu: keď pošle
 * jedno číslo, zákazník rozhoduje ÁNO/NIE. Keď pošle tri, rozhoduje KTORÚ —
 * a to je úplne iná otázka.
 *
 * DŮLEŽITÉ: hladiny se liší KRYTINOU, ne fólií.
 *
 * První verze je rozlišovala rozsahem (fólie, žľaby) a rozdíl vyšel 7 % —
 * tedy šum, ne volba. Střecha stojí 15 000 €, fólie 400 €. Přidávat drobky
 * k bochníku nikoho nepřesvědčí. Řemeslníci to tak nedělají: hladinu dělá
 * taška. Betón vs. keramika je rozdiel, ktorý je vidieť aj na fotke aj na cene.
 */

export type TierId = "zaklad" | "standard" | "premium";

/** Co navíc k tomu, co majster nadiktoval. */
const TIER_ADDS: Record<TierId, ScopeItem[]> = {
  zaklad: [],
  standard: ["fólia"],
  premium: ["fólia", "žľaby", "klampiarske prvky"],
};

const TIER_NAMES: Record<TierId, string> = {
  zaklad: "Základ",
  standard: "Štandard",
  premium: "Prémium",
};

export type TieredQuote = {
  id: TierId;
  name: string;
  /** Krytina téhle hladiny. */
  product: RoofProduct;
  pitch: string;
  recommended: boolean;
  /** true = tuhle krytinu majster sám nadiktoval. */
  asDictated: boolean;
  quote: Quote;
};

export function buildTiers(job: RoofJob, profile: CraftsmanProfile, dictated: RoofProduct | null): TieredQuote[] {
  const ids: TierId[] = ["zaklad", "standard", "premium"];

  return ids
    .map((id) => {
      const product = PRODUCTS.find((p) => p.grade === id);
      if (!product) return null;

      const scope = Array.from(new Set<ScopeItem>([...job.scope, ...TIER_ADDS[id]]));
      const variant: RoofJob = { ...job, scope };

      return {
        id,
        name: TIER_NAMES[id],
        product,
        pitch: product.pitch,
        // Doporučujeme to, co majster nadiktoval — on tam byl a viděl to.
        // Když nenadiktoval nic, doporučíme štandard.
        recommended: dictated ? product.id === dictated.id : id === "standard",
        asDictated: dictated?.id === product.id,
        quote: priceQuote(computeTakeoff(variant, product), profile),
      };
    })
    .filter((t): t is TieredQuote => t !== null);
}
