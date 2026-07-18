"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEFAULT_PROFILE, type CraftsmanProfile } from "@/lib/quote/profile";
import { loadProfile, restoreProfileIfMissing, saveProfile } from "@/lib/quote/profile-store";
import { authConfigured, createClient } from "@/lib/supabase/browser";

/**
 * Profil realizátora — ze zadání klienta:
 * "Realizátor si môže editovať hlavičku - svoje kontaktné údaje, logo firmy,
 *  svoje ceny práce a želanú ziskovosť zo zákazky v %."
 *
 * Nastaví se JEDNOU a od té chvíle se každá nabídka počítá sama. To je celý
 * ten produkt: apka nezná jeho ceny, ale zapamatuje si je.
 */
export default function Profil() {
  // Vycházíme z výchozích hodnot, ne z null. Kdyby se čekalo na useEffect,
  // vyrenderuje server prázdno a majster kouká na bílou obrazovku, než se
  // appka zhydratuje. Uložené hodnoty se dosadí hned potom.
  const router = useRouter();
  const [p, setP] = useState<CraftsmanProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setP(loadProfile());
    // Nový/vyměněný telefon: když tu profil ještě není, stáhneme ho ze zálohy.
    void restoreProfileIfMissing().then((restored) => {
      if (restored) setP(loadProfile());
    });
    // Kdo je přihlášený (ať má u odhlášení vidět svůj mail).
    const supabase = createClient();
    if (supabase) void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function update(patch: Partial<CraftsmanProfile>) {
    setP((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }

  function save() {
    saveProfile(p);
    setSaved(true);
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-2xl px-5 py-8 pb-32">
        <Link href="/" className="text-sm text-neutral-500 underline underline-offset-4">
          ← Späť na ponuku
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Moja firma</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Nastav raz. Odvtedy sa každá ponuka počíta tvojimi cenami.
        </p>

        <Section title="Kontakt na ponuke">
          <Field label="Názov firmy" value={p.company.name} onChange={(v) => update({ company: { ...p.company, name: v } })} />
          <Field label="Telefón" type="tel" value={p.company.phone} onChange={(v) => update({ company: { ...p.company, phone: v } })} />
          <Field label="E-mail" type="email" value={p.company.email} onChange={(v) => update({ company: { ...p.company, email: v } })} />
          <LogoField
            value={p.company.logoUrl}
            onChange={(v) => update({ company: { ...p.company, logoUrl: v } })}
          />
        </Section>

        <Section title="Moje ceny práce">
          <p className="-mt-1 mb-3 text-xs leading-relaxed text-neutral-400">
            Tieto čísla appka vedieť nemôže — u každého majstra sú iné. Kým ich nezmeníš,
            počíta s odhadom trhu.
          </p>
          <Num label="Demontáž + latovanie + pokládka" unit="€/m²" value={p.labour.perM2Full} onChange={(v) => update({ labour: { ...p.labour, perM2Full: v } })} />
          <Num label="Len pokládka krytiny" unit="€/m²" value={p.labour.perM2Covering} onChange={(v) => update({ labour: { ...p.labour, perM2Covering: v } })} />
          <Num label="Napojenie na komín" unit="€/ks" value={p.labour.perChimney} onChange={(v) => update({ labour: { ...p.labour, perChimney: v } })} />
          <Num label="Osadenie strešného okna" unit="€/ks" value={p.labour.perSkylight} onChange={(v) => update({ labour: { ...p.labour, perSkylight: v } })} />
        </Section>

        <Section title="Zisk a DPH">
          <Num label="Želaná ziskovosť zo zákazky" unit="%" value={p.marginPct} onChange={(v) => update({ marginPct: v })} />
          <Num label="DPH" unit="%" value={p.vatPct} onChange={(v) => update({ vatPct: v })} />
        </Section>

        <Section title="Termín realizácie">
          <p className="-mt-1 mb-2 text-xs leading-relaxed text-neutral-400">
            Prvá otázka každého zákazníka. Objaví sa v každej ponuke.
          </p>
          <Field
            label="Najbližší voľný termín"
            value={p.earliestTerm}
            onChange={(v) => update({ earliestTerm: v })}
          />
        </Section>

        {authConfigured() && (
          <Section title="Účet">
            {email && <p className="-mt-1 mb-2 text-sm text-neutral-500">Prihlásený ako {email}</p>}
            <button
              onClick={signOut}
              className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 active:bg-neutral-100"
            >
              Odhlásiť sa
            </button>
          </Section>
        )}
      </div>

      {/* Uložit musí být pod palcem, ne na konci dlouhé stránky. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            onClick={save}
            className="flex-1 rounded-xl bg-neutral-900 py-3.5 text-base font-medium text-white active:opacity-80"
          >
            Uložiť
          </button>
          {saved && <span className="text-sm text-green-700">Uložené ✓</span>}
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-neutral-900"
      />
    </label>
  );
}

/** 16px text, aby iOS při ťuknutí nezoomoval. Číselná klávesnice na mobilu. */
function Num({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="flex-1 text-[15px] leading-snug">{label}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            const n = parseFloat(e.target.value.replace(",", "."));
            if (Number.isFinite(n)) onChange(n);
            else if (e.target.value === "") onChange(0);
          }}
          className="w-24 rounded-lg border border-neutral-200 px-3 py-2.5 text-right text-base tabular-nums outline-none focus:border-neutral-900"
        />
        <span className="w-10 text-sm text-neutral-400">{unit}</span>
      </span>
    </label>
  );
}

/** Logo se ukládá jako data URL — bez úložiště souborů to je nejjednodušší cesta. */
function LogoField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <span className="text-xs text-neutral-400">Logo firmy</span>
      <div className="mt-1 flex items-center gap-3">
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Logo" className="h-12 w-auto rounded border border-neutral-200 bg-white p-1" />
            <button onClick={() => onChange(null)} className="text-sm text-neutral-500 underline underline-offset-4">
              Odstrániť
            </button>
          </>
        ) : (
          <label className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 text-sm text-neutral-400">
            Nahrať logo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => onChange(String(r.result));
                r.readAsDataURL(f);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
