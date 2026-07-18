import { NextRequest, NextResponse } from "next/server";
import { isUnauthenticated } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Hlas → text přes ElevenLabs Scribe.
 *
 * Majster mluví slovensky, na střeše, ve větru, s rukavicema. Tohle je hlavní
 * vstup celé aplikace — zadání klienta: "Majster stlačí tlačidlo mikrofónu
 * a prirodzene opíše zákazku."
 */
export async function POST(req: NextRequest) {
  if (await isUnauthenticated())
    return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("Chybí ELEVENLABS_API_KEY v .env.local");

    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: "Chybí nahrávka." }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append("file", audio, "nahravka.webm");
    upstream.append("model_id", process.env.ELEVENLABS_STT_MODEL ?? "scribe_v1");
    // Slovenština. Bez toho to občas přepne do češtiny a plete názvy obcí.
    upstream.append("language_code", process.env.STT_LANGUAGE ?? "slk");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: upstream,
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ transcript: data.text ?? "" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznámá chyba";
    console.error("[transcribe]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
