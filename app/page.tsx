import Pwa from "./pwa";
import QuoteFlow from "./quote-flow";
import { getPublicTenant } from "@/lib/tenant";

// Hlavní obrazovka = řemeslnická smyčka ze zadání klienta:
// hlas → parametry → doptání → orientační ponuka.
export default function Home() {
  return (
    <>
      <QuoteFlow company={getPublicTenant().name} />
      <Pwa />
    </>
  );
}
