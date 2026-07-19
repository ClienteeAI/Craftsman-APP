import { NextResponse } from "next/server";
import { createVideoUploadTarget } from "@/lib/quote/video-store";
import { isUnauthenticated } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Podpíše cieľ pre priame nahranie videa do Storage.
 *
 * Video sa potom nahrá z prehliadača PRIAMO do Supabase (nie cez Vercel funkciu),
 * takže sa obíde 4,5 MB limit na request. Vráti { direct:true, id, token }.
 * Keď Supabase nie je nastavené, vráti { direct:false } a klient padne na
 * klasické /api/video (demo režim, malé videá).
 */
export async function POST() {
  if (await isUnauthenticated())
    return NextResponse.json({ error: "Neprihlásený." }, { status: 401 });
  const target = await createVideoUploadTarget();
  if (!target) return NextResponse.json({ direct: false });
  return NextResponse.json({ direct: true, ...target });
}
