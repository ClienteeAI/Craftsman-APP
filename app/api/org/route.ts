import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createTeam,
  deleteTeam,
  ensureOrgContext,
  inviteMember,
  orgsEnabled,
  removeMember,
  renameOrg,
  updateMember,
  updateTeam,
} from "@/lib/org/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Prihlásený človek + jeho e-mail (pre bootstrap firmy). */
async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

/** Kontext firmy prihláseného človeka (a keď treba, založí ju). */
export async function GET() {
  if (!orgsEnabled()) return NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
  const user = await currentUser();
  if (!user) return NextResponse.json({ enabled: false }, { status: 401 });
  try {
    const ctx = await ensureOrgContext(user.id, user.email);
    return NextResponse.json({ enabled: true, ...ctx }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[org GET]", err);
    return NextResponse.json({ error: "Načítanie firmy zlyhalo." }, { status: 500 });
  }
}

/** Úpravy firmy/part. Rozlišuje sa poľom `action`. */
export async function POST(req: NextRequest) {
  if (!orgsEnabled()) return NextResponse.json({ enabled: false });
  const user = await currentUser();
  if (!user) return NextResponse.json({ enabled: false }, { status: 401 });

  try {
    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case "renameOrg":
        await renameOrg(user.id, body.orgId, body.name);
        break;
      case "createTeam":
        await createTeam(user.id, body.orgId, body.name);
        break;
      case "updateTeam":
        await updateTeam(user.id, body.teamId, {
          name: body.name,
          leadId: body.leadId,
          labourOverrides: body.labourOverrides,
        });
        break;
      case "deleteTeam":
        await deleteTeam(user.id, body.teamId);
        break;
      case "inviteMember":
        await inviteMember(user.id, body.orgId, body.email, body.teamId ?? null, body.role ?? "member");
        break;
      case "updateMember":
        await updateMember(user.id, body.orgId, body.memberId, { teamId: body.teamId, role: body.role });
        break;
      case "removeMember":
        await removeMember(user.id, body.orgId, body.memberId);
        break;
      default:
        return NextResponse.json({ error: "Neznáma akcia." }, { status: 400 });
    }

    // Vráť čerstvý kontext, ať sa UI prekreslí bez druhého requestu.
    const ctx = await ensureOrgContext(user.id, user.email);
    return NextResponse.json({ enabled: true, ...ctx });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Zmena zlyhala.";
    console.error("[org POST]", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
