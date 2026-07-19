import { getSupabase } from "@/lib/supabase";
import type { LabourOverrides, Member, Org, OrgContext, Role, Team } from "./types";

/**
 * Serverová strana vrstvy firmy. Bežíme cez service-role klienta (obchádza RLS,
 * rovnako ako zvyšok CRM) a scopovanie/oprávnenia riešime tu v kóde.
 *
 * Bez Supabase sú funkcie no-op / vracajú null — appka potom jede ako doteraz
 * (plochý model, jeden človek = jeho dáta).
 */

function rowToOrg(r: Record<string, unknown>): Org {
  return { id: r.id as string, name: r.name as string, ownerId: r.owner_id as string };
}
function rowToTeam(r: Record<string, unknown>): Team {
  return {
    id: r.id as string,
    orgId: r.org_id as string,
    name: r.name as string,
    leadId: (r.lead_id as string) ?? null,
    labourOverrides: (r.labour_overrides as LabourOverrides) ?? null,
  };
}
function rowToMember(r: Record<string, unknown>): Member {
  return {
    userId: r.user_id as string,
    orgId: r.org_id as string,
    teamId: (r.team_id as string) ?? null,
    role: r.role as Role,
    email: (r.email as string) ?? null,
  };
}

export function orgsEnabled(): boolean {
  return getSupabase() !== null;
}

/**
 * Vráti (a keď treba, založí) kontext firmy pre prihláseného človeka.
 *
 * Solo majster = jednočlenná firma, kde je sám majiteľom. Preto pri prvom
 * načítaní, keď človek nikde nie je členom, mu založíme vlastnú firmu a spravíme
 * ho majiteľom — a jeho existujúce zákazky doplníme do tejto firmy (org_id).
 */
export async function ensureOrgContext(userId: string, email?: string | null): Promise<OrgContext | null> {
  const db = getSupabase();
  if (!db) return null;

  // Kde už som členom?
  const { data: mine, error: mErr } = await db
    .from("memberships")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (mErr) throw new Error(`Načítanie členstva zlyhalo: ${mErr.message}`);

  let orgId: string;
  let role: Role;
  let myTeamId: string | null;

  if (mine) {
    orgId = mine.org_id as string;
    role = mine.role as Role;
    myTeamId = (mine.team_id as string) ?? null;
  } else {
    // Bootstrap: založ firmu a sprav ma majiteľom.
    const { data: created, error: oErr } = await db
      .from("orgs")
      .insert({ owner_id: userId, name: "Moja firma" })
      .select("*")
      .single();
    if (oErr) throw new Error(`Založenie firmy zlyhalo: ${oErr.message}`);
    orgId = created.id as string;
    role = "owner";
    myTeamId = null;
    const { error: memErr } = await db
      .from("memberships")
      .insert({ user_id: userId, org_id: orgId, role: "owner", email: email ?? null });
    if (memErr) {
      // Súbežný bootstrap (napr. dvojité načítanie): členstvo už vzniklo inde.
      // Zahoď osirelú firmu a použi tú existujúcu.
      await db.from("orgs").delete().eq("id", orgId);
      const { data: again, error: againErr } = await db
        .from("memberships")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (againErr || !again) throw new Error(`Založenie členstva zlyhalo: ${memErr.message}`);
      orgId = again.org_id as string;
      role = again.role as Role;
      myTeamId = (again.team_id as string) ?? null;
    } else {
      // Doplň existujúce zákazky do firmy.
      await db.from("jobs").update({ org_id: orgId }).eq("user_id", userId).is("org_id", null);
    }
  }

  const { data: orgRow, error: orgErr } = await db.from("orgs").select("*").eq("id", orgId).single();
  if (orgErr) throw new Error(`Načítanie firmy zlyhalo: ${orgErr.message}`);

  const { data: teamRows, error: tErr } = await db
    .from("teams")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (tErr) throw new Error(`Načítanie part zlyhalo: ${tErr.message}`);

  // Členov vidí len majiteľ.
  let members: Member[] = [];
  if (role === "owner") {
    const { data: memRows, error: memErr } = await db
      .from("memberships")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    if (memErr) throw new Error(`Načítanie členov zlyhalo: ${memErr.message}`);
    members = (memRows ?? []).map(rowToMember);
  }

  return {
    org: rowToOrg(orgRow),
    role,
    myTeamId,
    teams: (teamRows ?? []).map(rowToTeam),
    members,
  };
}

/** Overí, že daný človek je majiteľom firmy. Brána pred úpravami. */
async function assertOwner(db: NonNullable<ReturnType<typeof getSupabase>>, userId: string, orgId: string): Promise<void> {
  const { data, error } = await db.from("orgs").select("owner_id").eq("id", orgId).single();
  if (error) throw new Error(`Overenie firmy zlyhalo: ${error.message}`);
  if ((data.owner_id as string) !== userId) throw new Error("Len majiteľ firmy môže robiť túto zmenu.");
}

export async function renameOrg(userId: string, orgId: string, name: string): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  await assertOwner(db, userId, orgId);
  const { error } = await db.from("orgs").update({ name: name.trim() || "Moja firma" }).eq("id", orgId);
  if (error) throw new Error(`Premenovanie firmy zlyhalo: ${error.message}`);
}

export async function createTeam(userId: string, orgId: string, name: string): Promise<Team> {
  const db = getSupabase();
  if (!db) throw new Error("Supabase nie je nakonfigurované.");
  await assertOwner(db, userId, orgId);
  const { data, error } = await db
    .from("teams")
    .insert({ org_id: orgId, name: name.trim() || "Nová parta" })
    .select("*")
    .single();
  if (error) throw new Error(`Založenie party zlyhalo: ${error.message}`);
  return rowToTeam(data);
}

export async function updateTeam(
  userId: string,
  teamId: string,
  patch: { name?: string; leadId?: string | null; labourOverrides?: LabourOverrides | null },
): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  // Zisti org party a over vlastníctvo.
  const { data: t, error: tErr } = await db.from("teams").select("org_id").eq("id", teamId).single();
  if (tErr) throw new Error(`Načítanie party zlyhalo: ${tErr.message}`);
  await assertOwner(db, userId, t.org_id as string);

  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim() || "Nová parta";
  if (patch.leadId !== undefined) row.lead_id = patch.leadId;
  if (patch.labourOverrides !== undefined) row.labour_overrides = patch.labourOverrides;
  if (Object.keys(row).length === 0) return;

  const { error } = await db.from("teams").update(row).eq("id", teamId);
  if (error) throw new Error(`Úprava party zlyhala: ${error.message}`);
}

export async function deleteTeam(userId: string, teamId: string): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { data: t, error: tErr } = await db.from("teams").select("org_id").eq("id", teamId).single();
  if (tErr) throw new Error(`Načítanie party zlyhalo: ${tErr.message}`);
  await assertOwner(db, userId, t.org_id as string);
  const { error } = await db.from("teams").delete().eq("id", teamId);
  if (error) throw new Error(`Zmazanie party zlyhalo: ${error.message}`);
}
