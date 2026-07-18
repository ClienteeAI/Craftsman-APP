import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { compositeRoof, normalizePhoto } from "@/lib/composite";
import { renderRoof, type ReferenceImage } from "@/lib/gemini";
import { PRODUCTS, type RoofProduct } from "@/lib/quote/products";

/**
 * Produktové fotky od výrobce, stažené jednou a držené v paměti.
 *
 * Bez reference popisuju modelu tašku slovy ("flat black concrete tiles"),
 * což u dvou řad stejné tašky dopadne skoro stejně — a přitom je mezi nimi
 * 1 800 €. S fotkou má model co napodobit.
 */
const refCache = new Map<string, ReferenceImage | null>();

async function referenceFor(product: RoofProduct): Promise<ReferenceImage | null> {
  if (refCache.has(product.id)) return refCache.get(product.id)!;
  try {
    const res = await fetch(product.imageUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ref: ReferenceImage = {
      mimeType: res.headers.get("content-type") ?? "image/jpeg",
      data: Buffer.from(await res.arrayBuffer()),
    };
    refCache.set(product.id, ref);
    return ref;
  } catch (e) {
    // Fotka výrobce nedostupná → jedeme dál jen s popisem. Render bez
    // reference je horší, ale pořád lepší než spadlá appka.
    console.warn(`[render] referenční fotka ${product.id} nedostupná:`, e);
    refCache.set(product.id, null);
    return null;
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cache renderů na trojici (fotka + maska + produkt).
 *
 * Bez tohohle je každé přepnutí produktu nový render, tedy nové peníze.
 * S cachí zaplatíš tolik renderů, kolik je v katalogu položek, a ani o jeden víc.
 *
 * TODO: paměť jednoho procesu — přežije do restartu a instance se o ni
 * nepodělí. Před ostrým provozem do Supabase/R2, klíčované stejným hashem.
 */
const cache = new Map<string, Buffer>();

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const photoFile = form.get("photo");
    const maskFile = form.get("mask");
    const productId = form.get("productId");

    if (!(photoFile instanceof Blob) || !(maskFile instanceof Blob)) {
      return NextResponse.json({ error: "Chýba fotka alebo maska." }, { status: 400 });
    }

    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) {
      return NextResponse.json({ error: `Neznámy produkt: ${productId}` }, { status: 400 });
    }

    const photo = await normalizePhoto(Buffer.from(await photoFile.arrayBuffer()));
    const mask = Buffer.from(await maskFile.arrayBuffer());

    // ?ref=0 vypne referenční fotku — kvůli porovnání, jestli pomáhá.
    const useRef = new URL(req.url).searchParams.get("ref") !== "0";

    const key = createHash("sha256").update(photo).update(mask).update(product.id).update(String(useRef)).digest("hex");
    const hit = cache.get(key);
    if (hit) {
      return new NextResponse(new Uint8Array(hit), {
        headers: { "Content-Type": "image/png", "X-Cache": "HIT" },
      });
    }

    const reference = useRef ? await referenceFor(product) : null;

    const started = Date.now();
    const rendered = await renderRoof(photo, "image/png", product.renderPrompt, reference ?? undefined);
    const final = await compositeRoof(photo, rendered, mask);
    const ms = Date.now() - started;

    cache.set(key, final);

    return new NextResponse(new Uint8Array(final), {
      headers: { "Content-Type": "image/png", "X-Cache": "MISS", "X-Render-Ms": String(ms) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba";
    console.error("[render]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
