import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Běží před každým požadavkem (kromě statiky) a obnoví přihlašovací session.
 * Gating (kdo kam smí) řeší stránky samy — tady jen držíme token čerstvý.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Všechno kromě statiky a obrázků. Vynecháváme _next a soubory s příponou.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
