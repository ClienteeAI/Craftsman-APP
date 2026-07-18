import { NextRequest, NextResponse } from "next/server";
import { saveVideo } from "@/lib/quote/video-store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Nahrání videa. Vrátí id, které pak cestuje s nabídkou. */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("video");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "Chýba video." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 1000) {
      return NextResponse.json({ error: "Video je prázdne." }, { status: 400 });
    }
    const id = saveVideo(buffer, file.type);
    return NextResponse.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba";
    console.error("[video upload]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
