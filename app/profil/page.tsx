"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEFAULT_PROFILE, type CraftsmanProfile, type LabourItem } from "@/lib/quote/profile";
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
/** Proměnné použitelné v šablonách zpráv — zobrazí se jako nápověda. */
const VARS = [
  { key: "meno", desc: "meno zákazníka" },
  { key: "firma", desc: "tvoja firma" },
  { key: "odkaz", desc: "odkaz na ponuku" },
  { key: "termin", desc: "voľný termín" },
];

function newLabourId(): string {
  return "lab-" + Math.random().toString(36).slice(2, 9);
}

/** Jednotky pro vlastní položky práce. */
const UNITS = ["€/m²", "€/ks", "€/bm", "€/hod", "€/deň", "€ spolu"];

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
    <main className="min-h-screen text-neutral-900">
      <div className="mx-auto max-w-5xl px-5 py-8 pb-32">
        <Link href="/" className="text-sm text-neutral-500 underline underline-offset-4">
          ← Späť na ponuku
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Moja firma</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Nastav raz. Odvtedy sa každá ponuka počíta tvojimi cenami.
        </p>

        {/* Cihličky vedľa seba — na počítači využijú šírku, na mobile sa naskladajú. */}
        <div className="mt-8 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
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

          <CustomLabour
            items={p.customLabour}
            onChange={(customLabour) => update({ customLabour })}
          />
        </Section>

        <Section title="Zisk a DPH">
          <Num label="Želaná ziskovosť zo zákazky" unit="%" value={p.marginPct} onChange={(v) => update({ marginPct: v })} />
          <Num label="DPH" unit="%" value={p.vatPct} onChange={(v) => update({ vatPct: v })} />
        </Section>

        <Section title="Nastavenie komunikácie" wide>
          <p className="-mt-1 mb-1 text-xs leading-relaxed text-neutral-400">
            Predpripravené správy, ktoré appka vyplní pri odosielaní ponuky. Do textu môžeš
            vložiť premenné a doplnia sa samy:
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {VARS.map((v) => (
              <span key={v.key} className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                <code className="text-brand-700">{`{${v.key}}`}</code> {v.desc}
              </span>
            ))}
          </div>

          <Field
            label="E-mail na odosielanie ponúk"
            type="email"
            value={p.communication.offerEmail}
            onChange={(v) => update({ communication: { ...p.communication, offerEmail: v } })}
          />

          {/* Šablony vedľa seba — na širokej obrazovke sa nezroluje zbytočne. */}
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TextArea
              label="Správa cez WhatsApp / SMS"
              value={p.communication.waTemplate}
              rows={8}
              onChange={(v) => update({ communication: { ...p.communication, waTemplate: v } })}
            />
            <div className="space-y-3">
              <Field
                label="Predmet e-mailu"
                value={p.communication.emailSubject}
                onChange={(v) => update({ communication: { ...p.communication, emailSubject: v } })}
              />
              <TextArea
                label="Text e-mailu"
                value={p.communication.emailBody}
                rows={5}
                onChange={(v) => update({ communication: { ...p.communication, emailBody: v } })}
              />
            </div>
          </div>

          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            Pozn.: v SMS aj WhatsApp musí byť odkaz vypísaný ako text — schovať ho pod klikacie
            slovo sa v týchto kanáloch technicky nedá. „Klikacie slovo“ ide iba v e-maile
            posielanom cez server; to vieme doplniť neskôr.
          </p>
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
      </div>

      {/* Uložit musí být pod palcem, ne na konci dlouhé stránky. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            onClick={save}
            className="flex-1 rounded-xl bg-brand-600 py-3.5 text-base font-medium text-white active:opacity-80"
          >
            Uložiť
          </button>
          {saved && <span className="text-sm text-green-700">Uložené ✓</span>}
        </div>
      </div>
    </main>
  );
}

function Section({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`rounded-2xl border border-neutral-200/70 bg-card p-6 shadow-soft ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400">{title}</h2>
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
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-base shadow-soft outline-none transition hover:border-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
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
          className="w-24 rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-right text-base tabular-nums shadow-soft outline-none transition hover:border-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
        <span className="w-10 text-sm text-neutral-400">{unit}</span>
      </span>
    </label>
  );
}

/** Víceřádkový vstup — pro šablony zpráv. Stejný „je vidět" styl jako ostatní. */
function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full resize-none rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-base leading-relaxed shadow-soft outline-none transition hover:border-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
      />
      {hint && <span className="mt-1 block text-xs text-neutral-400">{hint}</span>}
    </label>
  );
}

/**
 * Vlastní řádky ceny práce. Majster si přidá, kolik chce; každý má název,
 * cenu a jednotku. Ukládají se v profilu spolu se zbytkem.
 */
function CustomLabour({
  items,
  onChange,
}: {
  items: LabourItem[];
  onChange: (items: LabourItem[]) => void;
}) {
  function set(id: string, patch: Partial<LabourItem>) {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function add() {
    onChange([...items, { id: newLabourId(), label: "", unit: "€/ks", price: 0 }]);
  }
  function remove(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }

  return (
    <div className="space-y-2 border-t border-black/5 pt-3">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2">
          <input
            value={it.label}
            placeholder="Napr. Demontáž bleskozvodu"
            onChange={(e) => set(it.id, { label: e.target.value })}
            className="min-w-0 flex-1 rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-[15px] shadow-soft outline-none transition hover:border-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
          <input
            inputMode="decimal"
            value={it.price}
            onChange={(e) => {
              const n = parseFloat(e.target.value.replace(",", "."));
              set(it.id, { price: Number.isFinite(n) ? n : 0 });
            }}
            className="w-20 rounded-lg border-2 border-neutral-300 bg-white px-2.5 py-2.5 text-right text-base tabular-nums shadow-soft outline-none transition hover:border-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
          <select
            value={it.unit}
            onChange={(e) => set(it.id, { unit: e.target.value })}
            className="w-24 shrink-0 rounded-lg border-2 border-neutral-300 bg-white px-2 py-2.5 text-center text-sm text-neutral-600 shadow-soft outline-none transition hover:border-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <button
            onClick={() => remove(it.id)}
            aria-label="Odstrániť položku"
            className="shrink-0 rounded-lg px-2 py-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="w-full rounded-lg border-2 border-dashed border-neutral-300 py-2.5 text-sm font-medium text-neutral-500 transition hover:border-brand-400 hover:text-brand-700"
      >
        + Pridať vlastnú položku
      </button>
    </div>
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
