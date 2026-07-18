"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authConfigured, createClient } from "@/lib/supabase/browser";

/**
 * Přihlášení řemeslníka. Email + heslo přes Supabase Auth.
 *
 * Jedna obrazovka, přepínač přihlásit/registrovat. Mobile-first — řemeslník to
 * otevře na telefonu. Po přihlášení jde na hlavní obrazovku.
 */
export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const configured = authConfigured();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const supabase = createClient();
    if (!supabase) {
      setError("Prihlásenie zatiaľ nie je nastavené.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Podle nastavenia projektu môže byť potrebné potvrdenie e-mailom.
        if (!data.session) {
          setInfo("Skontroluj e-mail a potvrď registráciu, potom sa prihlás.");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/prehlad");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nepodarilo sa.";
      // Přeložíme nejčastější hlášky do lidštiny.
      setError(
        /invalid login/i.test(msg)
          ? "Nesprávny e-mail alebo heslo."
          : /already registered/i.test(msg)
            ? "Tento e-mail už je zaregistrovaný. Prihlás sa."
            : /at least 6/i.test(msg)
              ? "Heslo musí mať aspoň 6 znakov."
              : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 text-neutral-900">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5 10.5V20h14v-9.5" />
            </svg>
          </div>
          <span className="text-sm font-medium text-neutral-500">Rýchla ponuka strechy</span>
        </div>

        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-soft sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Prihlásenie" : "Registrácia"}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {mode === "signin"
              ? "Prihlás sa do svojho účtu."
              : "Vytvor si účet — zákazky a ceny máš potom na každom zariadení."}
          </p>

          {!configured && (
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Prihlásenie ešte nie je nakonfigurované (chýba anon kľúč).
            </p>
          )}

          <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoCapitalize="none"
            placeholder="E-mail"
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-base outline-none focus:border-brand-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="Heslo"
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-base outline-none focus:border-brand-500"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-green-700">{info}</p>}

          <button
            type="submit"
            disabled={busy || !configured}
            className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-medium text-white shadow-soft transition hover:bg-brand-700 active:opacity-90 disabled:opacity-40 disabled:shadow-none"
          >
            {busy ? "Moment…" : mode === "signin" ? "Prihlásiť sa" : "Zaregistrovať sa"}
          </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            className="mt-5 w-full text-center text-sm font-medium text-neutral-500 underline underline-offset-4 transition hover:text-brand-700"
          >
            {mode === "signin" ? "Nemáš účet? Zaregistruj sa" : "Už máš účet? Prihlás sa"}
          </button>
        </div>
      </div>
    </main>
  );
}
