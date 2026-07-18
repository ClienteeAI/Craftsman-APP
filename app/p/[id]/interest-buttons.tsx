"use client";

import { useState } from "react";

/**
 * Spodní lišta na nabídce zákazníka — "Mám záujem" a "Napísať".
 *
 * Ťuknutí udělá dvě věci najednou: řekne serveru "zákazník má záujem" a zároveň
 * otevře telefon / mail. `keepalive`, aby odchod na tel: link nezrušil request
 * dřív, než odletí. Řemeslníkovi to hned naskočí na obrazovce — to je celý
 * smysl odkazu místo PDF: vidí zájem v okamžiku, kdy vzniká.
 *
 * Signál se pošle jen jednou (na desktopu tel: nic neudělá, ať to zákazník
 * neťuká pořád dokola) a zákazník dostane potvrzení, že se řemeslník ozve.
 */
export default function InterestButtons({
  id,
  phone,
  email,
  subject,
}: {
  id: string;
  phone: string;
  email: string;
  subject: string;
}) {
  const [sent, setSent] = useState(false);

  function tellInterested() {
    if (!sent) {
      try {
        fetch(`/api/share/${id}/interest`, { method: "POST", keepalive: true }).catch(() => {});
      } catch {
        // I kdyby signál nevyšel, hovor/mail musí proběhnout — proto tady nic neřešíme.
      }
      setSent(true);
    }
  }

  return (
    <>
      {sent && (
        <p className="mx-auto mb-3 max-w-2xl text-center text-sm font-medium text-green-700">
          Ďakujeme, majster sa vám čo najskôr ozve. ✓
        </p>
      )}
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <a
          href={`tel:${phone}`}
          onClick={tellInterested}
          className="flex-1 rounded-xl bg-brand-600 py-3.5 text-center text-base font-medium text-white active:opacity-80"
        >
          Mám záujem — zavolať
        </a>
        <a
          href={`mailto:${email}?subject=${encodeURIComponent(subject)}`}
          onClick={tellInterested}
          className="rounded-xl border border-neutral-300 px-5 py-3.5 text-base font-medium active:bg-neutral-100"
        >
          Napísať
        </a>
      </div>
    </>
  );
}
