import { getVideo } from "@/lib/quote/video-store";

export const runtime = "nodejs";

/**
 * Servíruje video s podporou HTTP Range requestů (206 Partial Content).
 *
 * Tohle je celý ten fix. Safari (a další) přehraje video jen tehdy, když si ho
 * může stáhnout po kouskách — pošle hlavičku "Range: bytes=0-" a čeká odpověď
 * 206 s částí souboru a hlavičkou Accept-Ranges. Bez toho ukazuje přeškrtnuté
 * play. Data URL tohle neumí; tenhle endpoint ano.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = getVideo(id);
  if (!video) return new Response("Not found", { status: 404 });

  const { buffer, contentType } = video;
  const total = buffer.length;
  const range = req.headers.get("range");

  const common = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };

  // Prohlížeč chce jen část — vrátíme 206 s tím kouskem.
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : total - 1;
      if (start >= total || end >= total || start > end) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      const chunk = buffer.subarray(start, end + 1);
      return new Response(new Uint8Array(chunk), {
        status: 206,
        headers: {
          ...common,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": String(chunk.length),
        },
      });
    }
  }

  // Bez Range — celé video.
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: { ...common, "Content-Length": String(total) },
  });
}
