import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Next.js 16 v dev režimu blokuje načítání skriptů, když jde požadavek z jiné
   * adresy než localhost. Telefon jde na síťovou IP notebooku, takže bez tohohle
   * se stránka vyrenderuje, ale nezhydratuje — a nejde kliknout vůbec na nic.
   *
   * Povolujeme jen lokální síť (192.168.x a 10.x). Netýká se to produkce na
   * Vercelu, tam se přistupuje přes doménu.
   */
  allowedDevOrigins: ["192.168.1.135", "192.168.0.0/16", "10.0.0.0/8"],
};

export default nextConfig;
