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
      router.push("/");
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
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-5 text-neutral-900">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight">
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
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-base outline-none focus:border-neutral-900"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="Heslo"
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-base outline-none focus:border-neutral-900"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-green-700">{info}</p>}

          <button
            type="submit"
            disabled={busy || !configured}
            className="w-full rounded-xl bg-neutral-900 py-3.5 text-base font-medium text-white active:opacity-80 disabled:opacity-40"
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
          className="mt-5 w-full text-center text-sm text-neutral-500 underline underline-offset-4"
        >
          {mode === "signin" ? "Nemáš účet? Zaregistruj sa" : "Už máš účet? Prihlás sa"}
        </button>
      </div>
    </main>
  );
}
