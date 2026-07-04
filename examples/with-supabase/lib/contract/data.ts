import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Deal, DealEvent } from "@/lib/types";
import type { ContractPackData, PackEvent } from "./render";

// Assembles everything the contract pack renders, using the CALLER's
// RLS-scoped client: if the caller is not a participant of the deal, the deal
// row simply does not exist for them and this returns null.

export async function getContractPackData(
  supabase: SupabaseClient,
  dealId: string,
): Promise<ContractPackData | null> {
  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .maybeSingle<Deal>();
  if (!deal) return null;

  const [{ data: org }, { data: events }, { data: attestations }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("name")
        .eq("id", deal.org_id)
        .maybeSingle<{ name: string }>(),
      supabase
        .from("deal_events")
        .select("seq, actor_id, event_type, payload, created_at, hash")
        .eq("deal_id", dealId)
        .order("seq", { ascending: true }),
      supabase
        .from("attestations")
        .select("typed_full_name, created_at, contract_snapshot_sha256")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: true }),
    ]);

  const actorIds = Array.from(
    new Set(
      [
        deal.financier_id,
        deal.customer_id,
        ...(events ?? []).map((e) => e.actor_id),
      ].filter((id): id is string => id != null),
    ),
  );
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", actorIds);
  const nameOf = (id: string | null) =>
    (id && profiles?.find((p) => p.user_id === id)?.full_name) || "System";

  const eventList = (events ?? []) as Pick<
    DealEvent,
    "seq" | "actor_id" | "event_type" | "payload" | "created_at" | "hash"
  >[];
  const at = (type: string) =>
    eventList.find((e) => e.event_type === type)?.created_at;

  const packEvents: PackEvent[] = eventList.map((e) => ({
    seq: e.seq,
    createdAt: e.created_at,
    eventType: e.event_type,
    actorName: nameOf(e.actor_id),
    hash: e.hash,
  }));

  return {
    deal,
    orgName: org?.name ?? "",
    financierName: nameOf(deal.financier_id),
    customerName: nameOf(deal.customer_id),
    milestones: {
      promiseRecordedAt: at("promise_recorded"),
      purchaseRecordedAt: at("purchase_recorded"),
      saleOfferedAt: at("sale_offered"),
      saleAcceptedAt: at("sale_accepted"),
      offeredAt: at("terms_offered"),
      acceptedAt: at("terms_accepted"),
      witnessingStartedAt: at("witnessing_started"),
    },
    attestations: (attestations ?? []).map((a) => ({
      typedFullName: a.typed_full_name,
      attestedAt: a.created_at,
      snapshotSha256: a.contract_snapshot_sha256,
    })),
    events: packEvents,
    generatedAt: new Date().toISOString(),
  };
}
