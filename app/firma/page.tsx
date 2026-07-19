"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadProfile } from "@/lib/quote/profile-store";
import type { LabourOverrides, Member, OrgContext, Team } from "@/lib/org/types";

/**
 * Firma — správa part (teams) a rolí. Etapa 1 vrstvy organizácie.
 *
 * Majiteľ tu zakladá party, priraďuje šéfa a nastavuje cenové výnimky party.
 * Členovia (a šéfovia) vidia len prehľad — kto sú, v akej role, v akej parte.
 * Pozvánky členov a priradenie zákaziek k parte prídu v ďalšej etape.
 */
export default function Firma() {
  const [ctx, setCtx] = useState<OrgContext | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [defaults] = useState(() => loadProfile().labour);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/org", { cache: "no-store" });
      const b = await res.json();
      if (!b.enabled) {
        setEnabled(false);
        return;
      }
      setCtx(b as OrgContext);
    } catch {
      setErr("Nepodarilo sa načítať firmu.");
    } finally {
      setLoading(false);
    }
  }

  async function act(payload: Record<string, unknown>) {
    setErr(null);
    try {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = await res.json();
      if (b.error) {
        setErr(b.error);
        return;
      }
      setCtx(b as OrgContext);
    } catch {
      setErr("Zmena zlyhala.");
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/prehlad" className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900">
          ← Prehľad
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Firma a party</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Rozdeľ firmu na party. Každá má svojho šéfa a môže mať vlastné ceny práce.
        </p>

        {err && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-neutral-400">Načítavam…</p>
        ) : !enabled ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
            Party potrebujú prihlásenie a cloud (Supabase) — dáta party sú zdieľané, nemôžu žiť len
            na jednom telefóne. Nastav prihlásenie a táto stránka ožije.
          </div>
        ) : !ctx ? null : ctx.role !== "owner" ? (
          <MemberView ctx={ctx} />
        ) : (
          <OwnerView ctx={ctx} defaults={defaults} act={act} />
        )}
      </div>
    </main>
  );
}

/** Pohľad člena/šéfa — len prehľad, bez úprav. */
function MemberView({ ctx }: { ctx: OrgContext }) {
  const myTeam = ctx.teams.find((t) => t.id === ctx.myTeamId);
  const roleLabel = ctx.role === "lead" ? "šéf party" : "člen";
  return (
    <div className="mt-8 rounded-2xl border border-neutral-200/70 bg-card p-6 shadow-soft">
      <p className="text-sm text-neutral-500">Firma</p>
      <p className="text-xl font-semibold">{ctx.org.name}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">Tvoja rola: {roleLabel}</span>
        {myTeam && <span className="rounded-full bg-neutral-100 px-3 py-1 font-medium">Parta: {myTeam.name}</span>}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-neutral-400">
        Party a členov spravuje majiteľ firmy. Ak niečo nesedí, ozvi sa mu.
      </p>
    </div>
  );
}

/** Pohľad majiteľa — plná správa. */
function OwnerView({
  ctx,
  defaults,
  act,
}: {
  ctx: OrgContext;
  defaults: { perM2Full: number; perM2Covering: number; perChimney: number; perSkylight: number };
  act: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [orgName, setOrgName] = useState(ctx.org.name);
  const [newTeam, setNewTeam] = useState("");

  return (
    <div className="mt-8 space-y-6">
      {/* Názov firmy */}
      <section className="rounded-2xl border border-neutral-200/70 bg-card p-6 shadow-soft">
        <label className="block">
          <span className="text-xs font-medium text-neutral-500">Názov firmy</span>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            onBlur={() => orgName.trim() !== ctx.org.name && act({ action: "renameOrg", orgId: ctx.org.id, name: orgName })}
            className="mt-1 w-full rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-base shadow-soft outline-none transition hover:border-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
        </label>
      </section>

      {/* Party */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Party ({ctx.teams.length})
        </h2>
        <div className="space-y-4">
          {ctx.teams.map((t) => (
            <TeamCard key={t.id} team={t} members={ctx.members} defaults={defaults} act={act} />
          ))}
          {ctx.teams.length === 0 && (
            <p className="rounded-2xl border border-dashed border-neutral-300 bg-card/50 p-5 text-sm text-neutral-400">
              Zatiaľ žiadne party. Pridaj prvú nižšie.
            </p>
          )}
        </div>

        {/* Pridať partu */}
        <div className="mt-4 flex gap-2">
          <input
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            placeholder="Názov novej party (napr. Parta Sever)"
            className="min-w-0 flex-1 rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-base shadow-soft outline-none transition hover:border-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
          <button
            onClick={async () => {
              if (!newTeam.trim()) return;
              await act({ action: "createTeam", orgId: ctx.org.id, name: newTeam });
              setNewTeam("");
            }}
            className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
          >
            + Pridať partu
          </button>
        </div>
      </section>

      {/* Členovia */}
      <section className="rounded-2xl border border-neutral-200/70 bg-card p-6 shadow-soft">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Členovia firmy</h2>
        <div className="mt-3 space-y-2">
          {ctx.members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{m.email ?? "—"}</span>
              <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium">
                {m.role === "owner" ? "majiteľ" : m.role === "lead" ? "šéf party" : "člen"}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-neutral-400">
          Pozvať majstrov e-mailom do party dorobíme v ďalšej etape. Zatiaľ si tu nastav štruktúru
          part a ceny.
        </p>
      </section>
    </div>
  );
}

function TeamCard({
  team,
  members,
  defaults,
  act,
}: {
  team: Team;
  members: Member[];
  defaults: { perM2Full: number; perM2Covering: number; perChimney: number; perSkylight: number };
  act: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(team.name);
  const [leadId, setLeadId] = useState<string | null>(team.leadId);
  const [ov, setOv] = useState<LabourOverrides>(team.labourOverrides ?? {});

  const OV_FIELDS: { key: keyof LabourOverrides; label: string; unit: string }[] = [
    { key: "perM2Full", label: "Demontáž + latovanie + pokládka", unit: "€/m²" },
    { key: "perM2Covering", label: "Len pokládka krytiny", unit: "€/m²" },
    { key: "perChimney", label: "Napojenie na komín", unit: "€/ks" },
    { key: "perSkylight", label: "Osadenie strešného okna", unit: "€/ks" },
  ];

  function save() {
    // Prázdne hodnoty vyhoď — parta ich zdedí z firmy.
    const clean: LabourOverrides = {};
    for (const f of OV_FIELDS) {
      const v = ov[f.key];
      if (typeof v === "number" && Number.isFinite(v)) clean[f.key] = v;
    }
    act({
      action: "updateTeam",
      teamId: team.id,
      name,
      leadId,
      labourOverrides: Object.keys(clean).length ? clean : null,
    });
  }

  return (
    <div className="rounded-2xl border border-neutral-200/70 bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border-2 border-neutral-300 bg-white px-3 py-2 text-base font-medium shadow-soft outline-none transition hover:border-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        />
        <button
          onClick={() => {
            if (confirm(`Zmazať partu „${team.name}"?`)) act({ action: "deleteTeam", teamId: team.id });
          }}
          aria-label="Zmazať partu"
          className="shrink-0 rounded-lg px-2 py-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
        >
          ✕
        </button>
      </div>

      {/* Šéf party */}
      <label className="mt-3 block">
        <span className="text-xs font-medium text-neutral-500">Šéf party</span>
        <select
          value={leadId ?? ""}
          onChange={(e) => setLeadId(e.target.value || null)}
          className="mt-1 w-full rounded-lg border-2 border-neutral-300 bg-white px-3 py-2.5 text-base shadow-soft outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        >
          <option value="">— zatiaľ bez šéfa —</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.email ?? m.userId.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>

      {/* Cenové výnimky */}
      <div className="mt-3">
        <p className="mb-2 text-xs font-medium text-neutral-500">
          Ceny práce party <span className="text-neutral-400">(prázdne = ako firma)</span>
        </p>
        <div className="space-y-2">
          {OV_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center gap-3">
              <span className="flex-1 text-[15px] leading-snug">{f.label}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <input
                  inputMode="decimal"
                  value={ov[f.key] ?? ""}
                  placeholder={String(defaults[f.key])}
                  onChange={(e) => {
                    const raw = e.target.value.replace(",", ".");
                    const n = parseFloat(raw);
                    setOv((prev) => ({ ...prev, [f.key]: raw === "" ? undefined : Number.isFinite(n) ? n : prev[f.key] }));
                  }}
                  className="w-24 rounded-lg border-2 border-neutral-300 bg-white px-3 py-2 text-right text-base tabular-nums shadow-soft outline-none transition hover:border-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                />
                <span className="w-10 text-sm text-neutral-400">{f.unit}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={save}
        className="mt-4 w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700"
      >
        Uložiť partu
      </button>
    </div>
  );
}
