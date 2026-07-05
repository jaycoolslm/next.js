import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { OrgRole } from "./types";

// Users may belong to multiple organisations (masjids). The active org is a
// cookie; every server action re-checks membership against the database — the
// cookie is a UI convenience, never an authorisation input.

const ACTIVE_ORG_COOKIE = "active_org";

export interface ActiveOrg {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
}

export async function getUserOrgs(): Promise<ActiveOrg[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_members")
    .select("role, organizations(id, name, slug)");
  if (error || !data) return [];
  return data
    .map((row) => {
      const org = row.organizations as unknown as {
        id: string;
        name: string;
        slug: string;
      } | null;
      if (!org) return null;
      return { id: org.id, name: org.name, slug: org.slug, role: row.role };
    })
    .filter((o): o is ActiveOrg => o !== null);
}

export async function getActiveOrg(): Promise<ActiveOrg | null> {
  const orgs = await getUserOrgs();
  if (orgs.length === 0) return null;
  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  return orgs.find((o) => o.id === preferred) ?? orgs[0];
}

/**
 * Server-side authorisation guard for the /admin area. Resolves the active org
 * and returns it only if the signed-in user is an admin of that org; otherwise
 * redirects to /dashboard. The role is derived from org_members via the
 * RLS-scoped client (getActiveOrg), so it cannot be spoofed from the cookie —
 * the cookie only selects *which* org is active, never the role. Every admin
 * page calls this (not just the layout) because in the App Router a layout and
 * its child pages render in parallel: a redirect in the layout alone would not
 * stop a page's own data fetching from running.
 */
export async function requireOrgAdmin(): Promise<ActiveOrg> {
  const activeOrg = await getActiveOrg();
  if (!activeOrg || activeOrg.role !== "admin") {
    redirect("/dashboard");
  }
  return activeOrg;
}

export async function setActiveOrgCookie(orgId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
