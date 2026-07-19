/**
 * Orientačná dĺžka realizácie z plochy strechy.
 *
 * Parta zvládne ~35–55 m²/deň; demontáž starej krytiny pridá deň. Je to len
 * odhad — majster ho v ponuke môže prepísať vlastným (spoľahlivejšie ako
 * vymyslené číslo).
 */

function dni(n: number): string {
  return n === 1 ? "deň" : n < 5 ? "dni" : "dní";
}

export function estimateDuration(
  items: { kind: string; unit: string; qty: number | null; label: string }[],
): string | null {
  const areaItem = items.find((i) => i.kind === "praca" && i.unit === "m²");
  const area = typeof areaItem?.qty === "number" ? areaItem.qty : null;
  if (!area || area <= 0) return null;
  const extra = items.some((i) => /demont/i.test(i.label)) ? 1 : 0;
  const low = Math.max(1, Math.ceil(area / 55) + extra);
  const high = Math.max(low, Math.ceil(area / 35) + extra);
  return low === high ? `približne ${low} ${dni(low)}` : `približne ${low}–${high} dní`;
}
