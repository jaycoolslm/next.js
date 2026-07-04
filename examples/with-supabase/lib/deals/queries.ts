import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Attestation,
  Deal,
  DealEvent,
  DealDocument,
  DealWitness,
  Profile,
  Repayment,
  TripwireAlert,
} from "@/lib/types";

// Read helpers for pages. Everything goes through the caller's RLS-scoped
// client: these functions can only ever return rows the signed-in user is
// entitled to see (participant of the deal / member of the org).

export interface DealWithNames extends Deal {
  financier_name: string;
  customer_name: string;
}

async function attachNames(deals: Deal[]): Promise<DealWithNames[]> {
  if (deals.length === 0) return [];
  const supabase = await createClient();
  const ids = Array.from(
    new Set(deals.flatMap((d) => [d.financier_id, d.customer_id])),
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", ids);
  const nameOf = (id: string) =>
    profiles?.find((p) => p.user_id === id)?.full_name ?? "Unknown";
  return deals.map((d) => ({
    ...d,
    financier_name: nameOf(d.financier_id),
    customer_name: nameOf(d.customer_id),
  }));
}

/** Deals where the signed-in user is financier or customer. */
export async function getMyDeals(orgId: string): Promise<DealWithNames[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", orgId)
    .or(`financier_id.eq.${user.id},customer_id.eq.${user.id}`)
    .order("created_at", { ascending: false });
  return attachNames((data ?? []) as Deal[]);
}

/** Deals where the signed-in user is an invited (or attested) witness. */
export async function getMyWitnessRequests(): Promise<
  Array<DealWithNames & { witness_status: string }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: rows } = await supabase
    .from("deal_witnesses")
    .select("deal_id, status")
    .eq("user_id", user.id);
  if (!rows || rows.length === 0) return [];
  const { data: deals } = await supabase
    .from("deals")
    .select("*")
    .in(
      "id",
      rows.map((r) => r.deal_id),
    );
  const withNames = await attachNames((deals ?? []) as Deal[]);
  return withNames.map((deal) => ({
    ...deal,
    witness_status:
      rows.find((r) => r.deal_id === deal.id)?.status ?? "invited",
  }));
}

export interface DealDetail {
  deal: DealWithNames;
  witnesses: Array<DealWitness & { full_name: string }>;
  documents: DealDocument[];
  repayments: Repayment[];
  events: Array<DealEvent & { actor_name: string }>;
  attestations: Attestation[];
  viewerRole: "financier" | "customer" | "witness";
  /** Confirmed repayments plus ibra' granted, in pence. */
  settledPence: number;
  /** total_price_pence (murabaha) or principal_pence (qard). */
  receivablePence: number;
}

export async function getDealDetail(dealId: string): Promise<DealDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .maybeSingle<Deal>();
  if (!deal) return null;

  const [
    { data: witnesses },
    { data: documents },
    { data: repayments },
    { data: events },
    { data: attestations },
  ] = await Promise.all([
    supabase.from("deal_witnesses").select("*").eq("deal_id", dealId),
    supabase
      .from("deal_documents")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at"),
    supabase
      .from("repayments")
      .select("*")
      .eq("deal_id", dealId)
      .order("paid_on"),
    supabase
      .from("deal_events")
      .select("*")
      .eq("deal_id", dealId)
      .order("seq"),
    supabase
      .from("attestations")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at"),
  ]);

  const personIds = Array.from(
    new Set([
      deal.financier_id,
      deal.customer_id,
      ...(witnesses ?? []).map((w) => w.user_id),
      ...(events ?? []).map((e) => e.actor_id).filter(Boolean),
    ]),
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", personIds as string[]);
  const nameOf = (id: string | null) =>
    (id && profiles?.find((p) => p.user_id === id)?.full_name) || "System";

  const ibraPence = (events ?? [])
    .filter((e) => e.event_type === "ibra_granted")
    .reduce((sum, e) => sum + Number(e.payload?.amount_pence ?? 0), 0);
  const confirmedPence = (repayments ?? [])
    .filter((r) => r.counterparty_confirmed)
    .reduce((sum, r) => sum + Number(r.amount_pence), 0);

  return {
    deal: {
      ...deal,
      financier_name: nameOf(deal.financier_id),
      customer_name: nameOf(deal.customer_id),
    },
    witnesses: (witnesses ?? []).map((w) => ({
      ...w,
      full_name: nameOf(w.user_id),
    })),
    documents: (documents ?? []) as DealDocument[],
    repayments: (repayments ?? []) as Repayment[],
    events: (events ?? []).map((e) => ({ ...e, actor_name: nameOf(e.actor_id) })),
    attestations: (attestations ?? []) as Attestation[],
    viewerRole:
      deal.financier_id === user.id
        ? "financier"
        : deal.customer_id === user.id
          ? "customer"
          : "witness",
    settledPence: confirmedPence + ibraPence,
    receivablePence: Number(
      (deal.type === "murabaha" ? deal.total_price_pence : deal.principal_pence) ??
        0,
    ),
  };
}

/**
 * Dashboard receivables: total outstanding owed to the user across active
 * deals where they are the financier. (Shown with the zakat-relevance label —
 * no fiqh ruling is given.)
 */
export async function getReceivablesSummary(orgId: string): Promise<{
  outstandingPence: number;
  activeDeals: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { outstandingPence: 0, activeDeals: 0 };
  const { data: deals } = await supabase
    .from("deals")
    .select("id, type, total_price_pence, principal_pence")
    .eq("org_id", orgId)
    .eq("financier_id", user.id)
    .in("status", ["active", "disputed", "in_arbitration"]);
  if (!deals || deals.length === 0) return { outstandingPence: 0, activeDeals: 0 };

  const dealIds = deals.map((d) => d.id);
  const [{ data: repayments }, { data: ibraEvents }] = await Promise.all([
    supabase
      .from("repayments")
      .select("deal_id, amount_pence, counterparty_confirmed")
      .in("deal_id", dealIds),
    supabase
      .from("deal_events")
      .select("deal_id, payload")
      .eq("event_type", "ibra_granted")
      .in("deal_id", dealIds),
  ]);

  let outstanding = 0;
  for (const deal of deals) {
    const receivable = Number(
      (deal.type === "murabaha" ? deal.total_price_pence : deal.principal_pence) ??
        0,
    );
    const paid = (repayments ?? [])
      .filter((r) => r.deal_id === deal.id && r.counterparty_confirmed)
      .reduce((sum, r) => sum + Number(r.amount_pence), 0);
    const ibra = (ibraEvents ?? [])
      .filter((e) => e.deal_id === deal.id)
      .reduce((sum, e) => sum + Number(e.payload?.amount_pence ?? 0), 0);
    outstanding += Math.max(0, receivable - paid - ibra);
  }
  return { outstandingPence: outstanding, activeDeals: deals.length };
}

export async function getMyTripwireAlerts(orgId: string): Promise<TripwireAlert[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("tripwire_alerts")
    .select("*")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as TripwireAlert[];
}

/** Profile of the signed-in user. */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Profile>();
  return data;
}
