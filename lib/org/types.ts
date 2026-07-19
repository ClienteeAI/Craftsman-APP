/**
 * Vrstva organizácie: firma → party → členovia.
 *
 * Firma je jednotka, ktorú si niekto kúpi. Vnútri má party (teams), každá má
 * šéfa (lead) a členov. Rola určuje, čo kto vidí a smie meniť.
 */

export type Role = "owner" | "lead" | "member";

/** Sadzby práce, ktoré si parta môže prepísať oproti firemnému cenníku. */
export type LabourOverrides = {
  perM2Full?: number;
  perM2Covering?: number;
  perChimney?: number;
  perSkylight?: number;
};

export type Org = {
  id: string;
  name: string;
  ownerId: string;
};

export type Team = {
  id: string;
  orgId: string;
  name: string;
  /** Šéf party (user id), alebo null keď zatiaľ nie je. */
  leadId: string | null;
  /** Cenové výnimky party. null = dedí firemný cenník. */
  labourOverrides: LabourOverrides | null;
};

export type Member = {
  userId: string;
  orgId: string;
  teamId: string | null;
  role: Role;
  email: string | null;
};

/** Všetko, čo appka potrebuje o firme prihláseného človeka naraz. */
export type OrgContext = {
  org: Org;
  /** Moja rola v tejto firme. */
  role: Role;
  /** Do ktorej party patrím (member/lead), alebo null. */
  myTeamId: string | null;
  teams: Team[];
  /** Členovia firmy — vidí ich len majiteľ (inak prázdne). */
  members: Member[];
};
