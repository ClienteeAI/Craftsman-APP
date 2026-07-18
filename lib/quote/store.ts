import { randomBytes } from "crypto";
import type { PricedItem } from "./pricing";
import { getSupabase, withDbRetry } from "@/lib/supabase";

/**
 * Uložené nabídky, na které se posílá odkaz zákazníkovi.
 *
 * ═══ DVA REŽIMY ═══
 * Když je nastavené Supabase (SUPABASE_URL + SERVICE_ROLE_KEY), nabídky žijí
 * v tabulce `quotes` — odkaz pak přežije restart serveru i víc instancí, takže
 * zákazník nikdy neuvidí 404. To je ostrý provoz.
 *
 * Když Supabase nastavené není, padá se na paměť procesu (níže). To je demo
 * režim: funguje na jednom běžícím serveru, po restartu se nabídky ztratí.
 * Přepnutí je čistě otázka vyplnění klíčů — kód se nemění.
 */

/** Jedna cenová úroveň pro výběr zákazníkem („zeptej se manželky"). */
export type OfferTier = {
  id: string;
  name: string;
  productName: string;
  range: { from: number; to: number };
  totals: { totalExVat: number; totalIncVat: number };
  items: PricedItem[];
};

export type SharedQuote = {
  id: string;
  createdAt: string;
  /** Hlavička z profilu realizátora — jeho logo, jeho kontakty. */
  company: { name: string; phone: string; email: string; logoUrl: string | null };
  customer: { name: string | null; obec: string | null; phone: string | null; email: string | null };
  summary: string;
  tierName: string;
  productName: string;
  /** Najbližší voľný termín z profilu. Prázdny = neukazuje sa. */
  earliestTerm: string;
  items: PricedItem[];
  totals: { materialTotal: number; labourTotal: number; totalExVat: number; totalIncVat: number };
  range: { from: number; to: number };
  assumptions: string[];
  /** Vizualizace (render nové střechy). Vstup: data URL, výstup: podepsaný odkaz. */
  imageDataUrl: string | null;
  /** Původní fotka baráku — pro posuvník před/po na zákaznické stránce. */
  beforeImageUrl: string | null;
  /** Atmosférické varianty (léto/sníh/večer/stárnutí), které majster vygeneroval. */
  variants: { key: string; url: string }[];
  /** Id videa (leží v /api/video/[id]). Prázdné = žádné video. */
  videoId: string | null;
  /** Kdy si ji zákazník poprvé otevřel. Řemeslník pak ví, kdy volat. */
  openedAt: string | null;
  /** Kdy zákazník ťukl "Mám záujem". Nejsilnější signál v celé apce. */
  interestedAt: string | null;
  /** 3 cenové úrovně na výběr. Prázdné = klasická nabídka s jednou cenou. */
  tiers: OfferTier[];
  /** Kterou úroveň si zákazník vybral (id). */
  chosenTier: string | null;
  /** Kdy zákazník nabídku závazně podepsal. */
  signedAt: string | null;
  /** Podpis zákazníka (podepsaný odkaz na obrázek ve storage). */
  signatureUrl: string | null;
};

/**
 * Fallback úložiště v paměti procesu (demo režim, když není Supabase).
 *
 * Přes globalThis, ne prosté `new Map()`: Next.js zabalí API endpoint a stránku
 * do oddělených balíčků, takže by každý dostal vlastní prázdnou Map a odkaz by
 * hodil 404. globalThis je jediné, co obě strany sdílejí. S nastaveným Supabase
 * je pravda v DB a tahle Map se ani nedotkne.
 */
const g = globalThis as typeof globalThis & { __quotes?: Map<string, SharedQuote> };
const mem: Map<string, SharedQuote> = (g.__quotes ??= new Map());

/** Krátké ID — jde nadiktovat do telefonu, když odkaz nedorazí. */
function newId(): string {
  return randomBytes(4).toString("hex");
}

/** Rozloží data URL na bajty + typ. Null když to není data URL. */
function parseDataUrl(u: string): { bytes: Buffer; contentType: string } | null {
  // [\s\S] místo flagu /s — ten vyžaduje novější JS target, který build nemá.
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(u);
  if (!m) return null;
  return { contentType: m[1], bytes: Buffer.from(m[2], "base64") };
}

type Db = NonNullable<ReturnType<typeof getSupabase>>;

/**
 * Nahraje data URL do storage bucketu 'renders' a vrátí odkaz `storage:<path>`.
 * Když to není data URL nebo upload selže, vrátí původní hodnotu (funguje dál,
 * jen inline). Null zůstane null.
 */
async function uploadImage(db: Db, path: string, dataUrl: string | null): Promise<string | null> {
  if (!dataUrl?.startsWith("data:")) return dataUrl;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return dataUrl;
  const { error } = await withDbRetry(() =>
    db.storage.from("renders").upload(path, parsed.bytes, {
      contentType: parsed.contentType,
      upsert: true,
    }),
  );
  return error ? dataUrl : `storage:${path}`;
}

/** Odkaz `storage:<path>` → čerstvý podepsaný odkaz. Jinak vrátí beze změny. */
async function resolveRef(db: Db, ref: string | null): Promise<string | null> {
  if (!ref?.startsWith("storage:")) return ref;
  const { data } = await db.storage.from("renders").createSignedUrl(ref.slice("storage:".length), 3600);
  return data?.signedUrl ?? null;
}

/** DB řádek → SharedQuote. snake_case sloupce ↔ camelCase v appce. */
function rowToQuote(r: Record<string, unknown>): SharedQuote {
  const media = (r.media as { before?: string; variants?: Record<string, string> } | null) ?? {};
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    company: r.company as SharedQuote["company"],
    customer: r.customer as SharedQuote["customer"],
    summary: (r.summary as string) ?? "",
    tierName: (r.tier_name as string) ?? "",
    productName: (r.product_name as string) ?? "",
    earliestTerm: (r.earliest_term as string) ?? "",
    items: (r.items as PricedItem[]) ?? [],
    totals: r.totals as SharedQuote["totals"],
    range: r.range as SharedQuote["range"],
    assumptions: (r.assumptions as string[]) ?? [],
    imageDataUrl: (r.image_url as string) ?? null,
    beforeImageUrl: media.before ?? null,
    variants: Object.entries(media.variants ?? {}).map(([key, url]) => ({ key, url })),
    videoId: (r.video_id as string) ?? null,
    openedAt: (r.opened_at as string) ?? null,
    interestedAt: (r.interested_at as string) ?? null,
    tiers: (r.tiers as OfferTier[]) ?? [],
    chosenTier: (r.chosen_tier as string) ?? null,
    signedAt: (r.signed_at as string) ?? null,
    signatureUrl: (r.signature_url as string) ?? null,
  };
}

export async function saveQuote(
  q: Omit<
    SharedQuote,
    "id" | "createdAt" | "openedAt" | "interestedAt" | "chosenTier" | "signedAt" | "signatureUrl"
  >,
  userId: string | null = null,
): Promise<SharedQuote> {
  const saved: SharedQuote = {
    ...q,
    id: newId(),
    createdAt: new Date().toISOString(),
    openedAt: null,
    interestedAt: null,
    chosenTier: null,
    signedAt: null,
    signatureUrl: null,
  };

  const db = getSupabase();
  if (db) {
    // Velké obrázky (render, původní fotka, varianty) nepatří do řádku —
    // nahrajeme je do storage a v DB necháme jen odkazy.
    const imageRef = await uploadImage(db, saved.id, saved.imageDataUrl);
    const beforeRef = await uploadImage(db, `${saved.id}-before`, saved.beforeImageUrl);
    const variantsMedia: Record<string, string> = {};
    for (const v of saved.variants) {
      const ref = await uploadImage(db, `${saved.id}-${v.key}`, v.url);
      if (ref) variantsMedia[v.key] = ref;
    }
    const media = { before: beforeRef, variants: variantsMedia };

    const { error } = await withDbRetry(() =>
      db.from("quotes").insert({
        id: saved.id,
        user_id: userId,
        created_at: saved.createdAt,
        company: saved.company,
        customer: saved.customer,
        summary: saved.summary,
        tier_name: saved.tierName,
        product_name: saved.productName,
        earliest_term: saved.earliestTerm,
        items: saved.items,
        totals: saved.totals,
        range: saved.range,
        assumptions: saved.assumptions,
        image_url: imageRef,
        media,
        tiers: saved.tiers,
        video_id: saved.videoId,
      }),
    );
    if (error) throw new Error(`Uloženie ponuky zlyhalo: ${error.message}`);
    return saved;
  }

  mem.set(saved.id, saved);
  return saved;
}

export async function getQuote(id: string): Promise<SharedQuote | undefined> {
  const db = getSupabase();
  if (db) {
    const { data, error } = await withDbRetry(() =>
      db.from("quotes").select("*").eq("id", id).maybeSingle(),
    );
    if (error) throw new Error(`Načítanie ponuky zlyhalo: ${error.message}`);
    if (!data) return undefined;
    const quote = rowToQuote(data as Record<string, unknown>);
    // Obrázky ve storage → čerstvé podepsané odkazy (stránka se rendruje per view).
    quote.imageDataUrl = await resolveRef(db, quote.imageDataUrl);
    quote.beforeImageUrl = await resolveRef(db, quote.beforeImageUrl);
    quote.variants = (
      await Promise.all(
        quote.variants.map(async (v) => ({ key: v.key, url: await resolveRef(db, v.url) })),
      )
    ).filter((v): v is { key: string; url: string } => v.url != null);
    quote.signatureUrl = await resolveRef(db, quote.signatureUrl);
    return quote;
  }
  return mem.get(id);
}

/**
 * Označí nabídku jako otevřenou. Vrací true jen poprvé.
 *
 * Tohle je nenápadně jedna z nejcennějších věcí v celé aplikaci: řemeslník
 * uvidí, že se zákazník na nabídku dívá, a může zvednout telefon ve chvíli,
 * kdy o tom zákazník přemýšlí. Konkurence pošle PDF do mailu a čeká.
 */
export async function markOpened(id: string): Promise<boolean> {
  const db = getSupabase();
  if (db) {
    // Jen když ještě není otevřená (opened_at is null) → true právě jednou.
    const { data, error } = await withDbRetry(() =>
      db
        .from("quotes")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", id)
        .is("opened_at", null)
        .select("id"),
    );
    if (error) throw new Error(`Označenie otvorenia zlyhalo: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }
  const q = mem.get(id);
  if (!q || q.openedAt) return false;
  q.openedAt = new Date().toISOString();
  return true;
}

/**
 * Zákazník ťukl "Mám záujem". Vrací true jen poprvé.
 *
 * Toto je vrchol celého toku: zákazník sám řekl ano. Řemeslník to má vidět
 * okamžitě a zvednout telefon, dokud je zákazník rozhodnutý. Otevření znamená
 * "dívá se", tohle znamená "chce to".
 */
export async function markInterested(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const db = getSupabase();
  if (db) {
    // Zájem zároveň zaručí, že je nabídka označená jako otevřená.
    const { data, error } = await withDbRetry(() =>
      db
        .from("quotes")
        .update({ interested_at: now, opened_at: now })
        .eq("id", id)
        .is("interested_at", null)
        .select("id"),
    );
    if (error) throw new Error(`Označenie záujmu zlyhalo: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }
  const q = mem.get(id);
  if (!q) return false;
  if (!q.openedAt) q.openedAt = now;
  if (q.interestedAt) return false;
  q.interestedAt = now;
  return true;
}

/**
 * Zákazník si vybral cenovú úroveň („zeptej se manželky"). Uloží volbu a
 * zároveň označí zájem. Vrací true, když je to první projev zájmu (pro push).
 */
export async function chooseTier(id: string, tierId: string): Promise<boolean> {
  const db = getSupabase();
  if (db) {
    const { error } = await withDbRetry(() =>
      db.from("quotes").update({ chosen_tier: tierId }).eq("id", id).select("id"),
    );
    if (error) throw new Error(`Uloženie voľby zlyhalo: ${error.message}`);
  } else {
    const q = mem.get(id);
    if (q) q.chosenTier = tierId;
  }
  return markInterested(id);
}

/**
 * Zákazník nabídku závazně podepsal. Uloží podpis (obrázek) + čas. Vrací true
 * jen poprvé — to je ta chvíle „z týdnů na hodinu".
 */
export async function signQuote(id: string, signatureDataUrl: string): Promise<boolean> {
  const now = new Date().toISOString();
  const db = getSupabase();
  if (db) {
    const ref = await uploadImage(db, `${id}-signature`, signatureDataUrl);
    const { data, error } = await withDbRetry(() =>
      db
        .from("quotes")
        .update({ signed_at: now, signature_url: ref })
        .eq("id", id)
        .is("signed_at", null)
        .select("id"),
    );
    if (error) throw new Error(`Uloženie podpisu zlyhalo: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }
  const q = mem.get(id);
  if (!q || q.signedAt) return false;
  q.signedAt = now;
  q.signatureUrl = signatureDataUrl;
  return true;
}
