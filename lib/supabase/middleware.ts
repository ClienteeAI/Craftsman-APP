import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Obnova Supabase session v každém požadavku.
 *
 * Bez tohohle by přihlašovací token po čase vypršel a řemeslník by byl náhodně
 * odhlašovaný. Middleware token potichu obnoví a přepíše cookies do odpovědi.
 *
 * Když auth není nakonfigurované (chybí anon klíč), jen propustí požadavek dál.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Nutné volat — obnoví token a zjistí, kdo je přihlášený.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gating: nepřihlášeného pošleme na /login. Veřejné zůstává přihlašování,
  // zákaznická nabídka (/p/), API (řeší si auth samy) a PWA soubory.
  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" ||
    path.startsWith("/p/") ||
    path.startsWith("/api/") ||
    path.startsWith("/manifest") ||
    path.startsWith("/sw.js") ||
    path.startsWith("/icon") ||
    path.startsWith("/apple-icon");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
