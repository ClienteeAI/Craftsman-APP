import type { PricedItem, Quote } from "./pricing";

/**
 * Přepočet součtů z položek. Žije zvlášť, protože ho potřebuje i klient —
 * když majster přepíše množství, musí se cena změnit OKAMŽITĚ, ne po kolečku
 * na server. Stojí na střeše a nemá čas čekat na síť.
 */
export function recomputeTotals(
  items: PricedItem[],
  opts: { marginPct: number; vatPct: number; rangePct?: number },
): Omit<Quote, "items" | "assumptions"> {
  const sum = (kind: "material" | "praca") =>
    items.filter((i) => i.kind === kind).reduce((a, i) => a + (i.total ?? 0), 0);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const materialTotal = r2(sum("material"));
  const labourTotal = r2(sum("praca"));
  const subtotal = r2(materialTotal + labourTotal);
  const margin = r2(subtotal * (opts.marginPct / 100));
  const totalExVat = r2(subtotal + margin);
  const vat = r2(totalExVat * (opts.vatPct / 100));
  const rangePct = opts.rangePct ?? 0.15;

  return {
    materialTotal,
    labourTotal,
    subtotal,
    margin,
    totalExVat,
    vat,
    totalIncVat: r2(totalExVat + vat),
    range: {
      from: Math.round(totalExVat * (1 - rangePct)),
      to: Math.round(totalExVat * (1 + rangePct)),
    },
  };
}

/** Přepočte řádek po ruční úpravě množství nebo ceny za kus. */
export function repriceItem(item: PricedItem, qty: number | null, unitPrice: number | null): PricedItem {
  return {
    ...item,
    qty,
    unitPrice,
    total: qty != null && unitPrice != null ? Math.round(qty * unitPrice * 100) / 100 : null,
    // Jakmile do toho majster sáhne, přestává to být odhad apky a stává se to
    // jeho číslem. Štítek musí přestat lhát.
    confidence: "manual",
    priceIsPlaceholder: false,
    note: "Upravil si ručne.",
  };
}
