import { NextRequest, NextResponse } from "next/server";
import { extractJob } from "@/lib/quote/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Nadiktovaná/napsaná řeč → parametry zakázky + doptání na chybějící. */
export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();
    if (typeof transcript !== "string" || !transcript.trim()) {
      return NextResponse.json({ error: "Chybí transcript." }, { status: 400 });
    }

    const started = Date.now();
    const extraction = await extractJob(transcript);

    return NextResponse.json(extraction, {
      headers: { "X-Extract-Ms": String(Date.now() - started) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznámá chyba";
    console.error("[extract]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
