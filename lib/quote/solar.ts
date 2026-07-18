/**
 * Solárny odhad. „Vaša strecha vyrobí X kWh ročne."
 *
 * Zo sklonu, orientácie a plochy strechy spočíta orientačnú ročnú výrobu FV
 * elektrárne. Dáta z PVGIS (Európska komisia, zadarmo, bez kľúča) — reálne
 * ožiarenie pre danú polohu, nie odhad z prsta. Polohu získame geokódovaním
 * obce (OpenStreetMap Nominatim, zadarmo).
 *
 * Je to UPSELL a wow pre zákazníka, nie projekt — preto orientačne a s
 * poctivým "over projektantom".
 */

export type SolarEstimate = {
  kWp: number;
  annualKwh: number;
  usableAreaM2: number;
  lat: number;
  lon: number;
  /** Poloha z obce, nebo náhradní střed SK, když geokódování selže. */
  approxLocation: boolean;
};

// Střed Slovenska — fallback, když se obec nedá najít. Ožáření se po malé zemi
// liší jen mírně, takže odhad zůstane rozumný.
const SK_FALLBACK = { lat: 48.7, lon: 19.5 };

/** m² střechy na 1 kWp (panely ~400 W ≈ 2 m²; s rozestupy ~6 m²/kWp). */
const M2_PER_KWP = 6;
/** Kolik z celkové plochy střechy je reálně využitelné pro panely. */
const USABLE_FRACTION = 0.45;

async function geocodeObec(obec: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      `${obec}, Slovensko`,
    )}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RychlaPonukaStrechy/1.0 (roofing app)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/**
 * Roční výroba z PVGIS.
 * @param aspect azimut: 0 = jih, -90 = východ, 90 = západ (konvence PVGIS).
 */
async function pvgisAnnual(
  lat: number,
  lon: number,
  kWp: number,
  angleDeg: number,
  aspect: number,
): Promise<number | null> {
  try {
    const url =
      `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lon}` +
      `&peakpower=${kWp}&loss=14&angle=${Math.round(angleDeg)}&aspect=${aspect}&outputformat=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { outputs?: { totals?: { fixed?: { E_y?: number } } } };
    const e = data.outputs?.totals?.fixed?.E_y;
    return typeof e === "number" ? Math.round(e) : null;
  } catch {
    return null;
  }
}

export async function estimateSolar(input: {
  obec: string | null;
  areaM2: number;
  pitchDeg: number | null;
  /** Azimut střechy (0 jih, -90 východ, 90 západ). Výchozí jih. */
  aspect?: number;
}): Promise<SolarEstimate | null> {
  const usableAreaM2 = Math.round(input.areaM2 * USABLE_FRACTION);
  const kWp = Math.round((usableAreaM2 / M2_PER_KWP) * 10) / 10;
  if (kWp <= 0) return null;

  const geo = input.obec ? await geocodeObec(input.obec) : null;
  const { lat, lon } = geo ?? SK_FALLBACK;
  // Bez sklonu vezmeme 35° — typická sedlová střecha, blízko optimu pro SK.
  const angle = input.pitchDeg ?? 35;
  const aspect = input.aspect ?? 0;

  const annualKwh = await pvgisAnnual(lat, lon, kWp, angle, aspect);
  if (annualKwh == null) return null;

  return { kWp, annualKwh, usableAreaM2, lat, lon, approxLocation: geo == null };
}
