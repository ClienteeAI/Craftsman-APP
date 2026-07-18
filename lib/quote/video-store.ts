/**
 * Úložiště videí. Video se NEUKLÁDÁ do nabídky jako text — leží zvlášť a
 * stránka zákazníka si ho stáhne z vlastní adresy /api/video/[id].
 *
 * Proč: prohlížeče (hlavně Safari na iPhonu) přehrají video jen tehdy, když ho
 * můžou stahovat po kouskách (HTTP Range requesty). Video nacpané přímo do
 * stránky jako data URL to neumožňuje — proto se ukazovalo přeškrtnuté play.
 *
 * ⚠️ PAMĚŤ PROCESU. Přežije do restartu a na Vercelu se o ni instance nepodělí.
 * Do provozu MUSÍ do R2/Supabase storage — video je přesně to, co do paměti
 * nepatří. Pro demo na jednom serveru to stačí.
 */

import { randomBytes } from "crypto";

type StoredVideo = { buffer: Buffer; contentType: string };

const g = globalThis as typeof globalThis & { __videos?: Map<string, StoredVideo> };
const videos: Map<string, StoredVideo> = (g.__videos ??= new Map());

export function saveVideo(buffer: Buffer, contentType: string): string {
  const id = randomBytes(6).toString("hex");
  videos.set(id, { buffer, contentType: contentType || "video/mp4" });
  return id;
}

export function getVideo(id: string): StoredVideo | undefined {
  return videos.get(id);
}
