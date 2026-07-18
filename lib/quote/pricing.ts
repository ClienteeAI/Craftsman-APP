import { priceFor } from "./pricelist";
import type { CraftsmanProfile, Money } from "./profile";
import type { LineItem, Takeoff } from "./takeoff";

export type PricedItem = LineItem & {
  unitPrice: Money | null;
  total: Money | null;
  /** true = cena je výchozí odhad trhu, ne majstrova. V UI musí být vidět. */
  priceIsPlaceholder: boolean;
};

export type Quote = {
  items: PricedItem[];
  materialTotal: Money;
  labourTotal: Money;
  subtotal: Money;
  margin: Money;
  /** Cena bez DPH — to, co majster inkasuje. */
  totalExVat: Money;
  vat: Money;
  totalIncVat: Money;
  /** Zadání chce "orientačnú cenu" — proto rozpětí, ne jedno číslo. */
  range: { from: Money; to: Money };
  assumptions: string[];
};

/**
 * Cena jednotky.
 *
 * Pořadí zdrojů je záměrné:
 *   1. Oficiální ceník výrobce  → ověřená cena, dohledatelná na stránku
 *   2. Profil řemeslníka        → jeho vlastní ceny (sazby za práci)
 *   3. null                     → apka to neví a řekne to nahlas
 *
 * Nikdy nic nedopočítáváme ani neodhadujeme mimo tyhle tři cesty.
 */
function unitPriceFor(
  item: LineItem,
  profile: CraftsmanProfile,
): { price: Money | null; fromPriceList: boolean } {
  if (item.kind === "praca") {
    // Normohodiny apka vědět nemůže — liší se mezi majstry dvojnásobně.
    if (item.unit === "m²") {
      return {
        price: item.label.toLowerCase().includes("demontáž")
          ? profile.labour.perM2Full
          : profile.labour.perM2Covering,
        fromPriceList: false,
      };
    }
    if (item.label.toLowerCase().includes("komín")) return { price: profile.labour.perChimney, fromPriceList: false };
    if (item.label.toLowerCase().includes("okn")) return { price: profile.labour.perSkylight, fromPriceList: false };
    return { price: null, fromPriceList: false };
  }

  // Materiál: nejdřív oficiální ceník.
  if (item.productId) {
    const listed = priceFor(item.productId);
    if (listed) {
      if (item.label.includes("základná škridla")) return { price: listed.perPiece, fromPriceList: true };
      if (item.label.includes("Hrebenáče")) return { price: listed.ridgeTile.price, fromPriceList: true };
    }
  }

  return { price: profile.materialPrices[item.label] ?? null, fromPriceList: false };
}

/**
 * Orientační rozpětí. Zadání klienta říká:
 * "Ponuka slúži ako rýchly prvý cenový odhad, nie ako realizačný rozpočet."
 *
 * Proto ±15 % a ne jedno přesné číslo. Přesné číslo v nabídce, která stojí na
 * odhadnutém hřebeni, je lež — a je to lež, za kterou zaplatí majster.
 */
const RANGE_PCT = 0.15;

export function priceQuote(takeoff: Takeoff, profile: CraftsmanProfile): Quote {
  const items: PricedItem[] = takeoff.items.map((item) => {
    const { price: unitPrice, fromPriceList } = unitPriceFor(item, profile);
    return {
      ...item,
      unitPrice,
      total: unitPrice != null && item.qty != null ? Math.round(unitPrice * item.qty * 100) / 100 : null,
      // Cena z oficiálního ceníku není odhad — je dohledatelná na stránku.
      priceIsPlaceholder: !fromPriceList,
      // Řádek s cenou z ceníku si zaslouží jiný štítek než můj odhad.
      confidence: fromPriceList && item.confidence === "computed" ? "computed" : item.confidence,
      note: fromPriceList ? `${item.note ?? ""} Cena z cenníka výrobcu.`.trim() : item.note,
    };
  });

  const sum = (kind: "material" | "praca") =>
    items.filter((i) => i.kind === kind).reduce((a, i) => a + (i.total ?? 0), 0);

  const materialTotal = Math.round(sum("material") * 100) / 100;
  const labourTotal = Math.round(sum("praca") * 100) / 100;
  const subtotal = materialTotal + labourTotal;
  const margin = Math.round(subtotal * (profile.marginPct / 100) * 100) / 100;
  const totalExVat = Math.round((subtotal + margin) * 100) / 100;
  const vat = Math.round(totalExVat * (profile.vatPct / 100) * 100) / 100;

  return {
    items,
    materialTotal,
    labourTotal,
    subtotal,
    margin,
    totalExVat,
    vat,
    totalIncVat: Math.round((totalExVat + vat) * 100) / 100,
    range: {
      from: Math.round(totalExVat * (1 - RANGE_PCT)),
      to: Math.round(totalExVat * (1 + RANGE_PCT)),
    },
    assumptions: takeoff.assumptions,
  };
}
