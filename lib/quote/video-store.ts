/**
 * Úložiště videopozdravů. Video se NEUKLÁDÁ do nabídky jako text — leží zvlášť
 * a stránka zákazníka si ho stáhne z vlastní adresy /api/video/[id].
 *
 * Proč: prohlížeče (hlavně Safari na iPhonu) přehrají video jen tehdy, když ho
 * můžou stahovat po kouskách (HTTP Range requesty). Video nacpané přímo do
 * stránky jako data URL to neumožňuje — proto se ukazovalo přeškrtnuté play.
 *
 * ═══ DVA REŽIMY ═══
 * S nastaveným Supabase leží video v Storage bucketu 'videos' a servíruje se
 * přes dočasný podepsaný odkaz (Supabase CDN umí Range samo). To je ostrý
 * provoz — video přežije restart i víc instancí a nezatěžuje paměť serveru.
 *
 * Bez Supabase padá na paměť procesu (níže) a Range servíruje náš endpoint.
 * Demo režim: funguje na jednom serveru, po restartu se videa ztratí.
 */

import { randomBytes } from "crypto";
import { getSupabase, withDbRetry } from "@/lib/supabase";

const BUCKET = "videos";

type StoredVideo = { buffer: Buffer; contentType: string };

const g = globalThis as typeof globalThis & { __videos?: Map<string, StoredVideo> };
const mem: Map<string, StoredVideo> = (g.__videos ??= new Map());

/**
 * Cieľ pre priame nahranie videa do Storage (obchádza Vercel 4,5 MB limit).
 *
 * Server podpíše upload URL; klient potom nahrá súbor PRIAMO do Supabase, nie
 * cez našu funkciu. Vráti id (= cesta v buckete) a token, ktorým klient upload
 * autorizuje. Null keď Supabase nie je nastavené (padne sa na /api/video).
 */
export async function createVideoUploadTarget(): Promise<{ id: string; token: string } | null> {
  const db = getSupabase();
  if (!db) return null;
  const id = randomBytes(6).toString("hex");
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(id);
  if (error || !data) return null;
  return { id, token: data.token };
}

export async function saveVideo(buffer: Buffer, contentType: string): Promise<string> {
  const id = randomBytes(6).toString("hex");
  const type = contentType || "video/mp4";

  const db = getSupabase();
  if (db) {
    const { error } = await withDbRetry(() =>
      db.storage.from(BUCKET).upload(id, buffer, { contentType: type, upsert: false }),
    );
    if (error) throw new Error(`Uloženie videa zlyhalo: ${error.message}`);
    return id;
  }

  mem.set(id, { buffer, contentType: type });
  return id;
}

/**
 * Zdroj videa pro servírování. Buď podepsaný odkaz (Supabase — přesměrujeme na
 * něj a Range řeší jejich CDN), nebo buffer z paměti (fallback — Range řešíme
 * my). Null = video neexistuje.
 */
export type VideoSource =
  | { kind: "redirect"; url: string }
  | { kind: "buffer"; buffer: Buffer; contentType: string }
  | null;

export async function getVideoSource(id: string): Promise<VideoSource> {
  const db = getSupabase();
  if (db) {
    // Podepsaný odkaz platí hodinu — generuje se čerstvý při každém požadavku,
    // takže expirace nevadí (video element si ho stáhne hned).
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(id, 3600);
    if (error || !data) return null;
    return { kind: "redirect", url: data.signedUrl };
  }

  const v = mem.get(id);
  return v ? { kind: "buffer", buffer: v.buffer, contentType: v.contentType } : null;
}
