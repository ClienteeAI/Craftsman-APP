import type { MetadataRoute } from "next";
import { getPublicTenant } from "@/lib/tenant";

/**
 * PWA manifest — díky tomuhle si majster ťukne "Pridať na plochu" a má na
 * telefonu ikonu. Zadání klienta: "PWA aplikácia ... s vytvorením ikony
 * v mobile užívateľa s preklikom na web a prihlásením (len prvotným)".
 *
 * Je to per tenant: každá instance má vlastní jméno, ikonu i barvu, takže si
 * StavajKvalitne i kdokoli další nainstaluje "svoji" appku.
 */
export default function manifest(): MetadataRoute.Manifest {
  const tenant = getPublicTenant();
  return {
    name: `${tenant.name} — Rýchla ponuka strechy`,
    short_name: "Ponuka strechy",
    description: "Nadiktuj obhliadku, dostaneš cenovú ponuku.",
    start_url: "/",
    // standalone = po instalaci žádný adresní řádek, vypadá to jako appka
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    lang: tenant.locale,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable = Android si ikonu ořízne do svého tvaru bez bílého rámečku
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
