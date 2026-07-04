// Integration tests proving the two load-bearing security properties:
//
//   1. RLS isolation — no user can see a deal they are not a party, witness,
//      or invited participant to (the financial-promotion firewall).
//   2. Hash-chain integrity — the event log is append-only and verifiable.
//
// They need a live local stack (`npx supabase start`, seeded via
// `supabase db reset`) and the env vars from .env.example. When the stack is
// not reachable the suite skips with a message instead of failing, so plain
// `pnpm test` stays green in CI-less environments.
//
// Run: pnpm test:integration   (after: npx supabase start)

import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyChain, type ChainRow } from "@/lib/verify-chain";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUBLISHABLE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

const PASSWORD = "password123";
const FINANCIER = "financier@demo.test";
const CUSTOMER = "customer@demo.test";
const WITNESS_1 = "witness1@demo.test";

async function stackIsUp(): Promise<boolean> {
  if (!PUBLISHABLE || !SECRET) return false;
  try {
    const res = await fetch(`${URL}/auth/v1/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function anonClient(): SupabaseClient {
  return createClient(URL, PUBLISHABLE!, { auth: { persistSession: false } });
}

function serviceClient(): SupabaseClient {
  return createClient(URL, SECRET!, { auth: { persistSession: false } });
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

const up = await stackIsUp();
if (!up) {
  console.warn(
    "[282] Skipping integration tests: local Supabase stack not reachable. " +
      "Run `npx supabase start` and set env per .env.example.",
  );
}

describe.skipIf(!up)("RLS isolation (financial-promotion firewall)", () => {
  let dealId: string;
  let outsider: SupabaseClient;

  beforeAll(async () => {
    // The seeded demo murabaha, fetched with the service role.
    const service = serviceClient();
    const { data: deal, error } = await service
      .from("deals")
      .select("id, org_id")
      .eq("type", "murabaha")
      .limit(1)
      .single();
    if (error) throw new Error(`seeded deal not found: ${error.message}`);
    dealId = deal.id;

    // An authenticated user with NO org membership and no deal involvement.
    const email = `outsider-${Date.now()}@demo.test`;
    const { error: createError } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Outsider" },
    });
    if (createError) throw new Error(createError.message);
    outsider = await signIn(email);
  }, 30_000);

  it("anon gets nothing from any domain table", async () => {
    const anon = anonClient();
    for (const table of [
      "deals",
      "deal_events",
      "deal_documents",
      "deal_witnesses",
      "repayments",
      "attestations",
      "organizations",
      "org_members",
      "profiles",
      "invitations",
      "tripwire_alerts",
    ]) {
      const { data } = await anon.from(table).select("*").limit(5);
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("an authenticated non-participant cannot see the deal or its children", async () => {
    const { data: deals } = await outsider.from("deals").select("*");
    expect(deals ?? []).toHaveLength(0);

    for (const table of [
      "deal_events",
      "deal_documents",
      "deal_witnesses",
      "repayments",
      "attestations",
    ]) {
      const { data } = await outsider
        .from(table)
        .select("*")
        .eq("deal_id", dealId);
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("a non-participant cannot read the deal's storage objects", async () => {
    const service = serviceClient();
    const { data: doc } = await service
      .from("deal_documents")
      .select("storage_path")
      .eq("deal_id", dealId)
      .eq("kind", "purchase_receipt")
      .limit(1)
      .single();
    expect(doc).toBeTruthy();

    const { data, error } = await outsider.storage
      .from("deal-documents")
      .download(doc!.storage_path);
    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });

  it("a participant CAN see the deal (sanity check that RLS is not just off)", async () => {
    const financier = await signIn(FINANCIER);
    const { data } = await financier.from("deals").select("id").eq("id", dealId);
    expect(data).toHaveLength(1);

    const witness = await signIn(WITNESS_1);
    // The seeded deal is pre-witnessing, so the witness may or may not be
    // invited yet — but the query must not error either way.
    const { error } = await witness.from("deals").select("id").eq("id", dealId);
    expect(error).toBeNull();
  });

  it("parties cannot update deal status directly — only via advance_deal", async () => {
    const financier = await signIn(FINANCIER);
    const { data } = await financier
      .from("deals")
      .update({ status: "active" })
      .eq("id", dealId)
      .select();
    // Either zero rows updated (no UPDATE policy) or an explicit trigger error.
    expect(data ?? []).toHaveLength(0);

    const service = serviceClient();
    const { data: after } = await service
      .from("deals")
      .select("status")
      .eq("id", dealId)
      .single();
    expect(after!.status).not.toBe("active");
  });

  it("illegal state transitions raise", async () => {
    const financier = await signIn(FINANCIER);
    // Seeded deal is at ownership_window; accept_sale is the customer's move
    // on sale_offered, so this must fail twice over.
    const { error } = await financier.rpc("advance_deal", {
      p_deal_id: dealId,
      p_action: "accept_sale",
      p_payload: {},
    });
    expect(error).toBeTruthy();
  });

  it("an authenticated witness cannot call attest_deal directly (OTP gate is server-mediated)", async () => {
    // C-1 fix: attest_deal is revoked from `authenticated`, so a witness who
    // tries to bypass the server action's OTP check by calling the RPC with
    // their own session is denied at the privilege level.
    const witness = await signIn(WITNESS_1);
    const { error } = await witness.rpc("attest_deal", {
      p_deal_id: dealId,
      p_witness_user_id: (await witness.auth.getUser()).data.user!.id,
      p_typed_full_name: "Bypass Attempt",
      p_snapshot_sha256: "0".repeat(64),
      p_otp_verified_at: new Date().toISOString(),
      p_user_agent: "test",
    });
    expect(error).toBeTruthy();
  });

  it("a deal party cannot be added as a witness on their own deal", async () => {
    const service = serviceClient();
    const { data: deal } = await service
      .from("deals")
      .select("customer_id")
      .eq("id", dealId)
      .single();
    const financier = await signIn(FINANCIER);
    const { error } = await financier.rpc("add_deal_witness", {
      p_deal_id: dealId,
      p_witness_user_id: deal!.customer_id,
    });
    expect(error).toBeTruthy();
  });
});

describe.skipIf(!up)("hash-chained append-only event log", () => {
  let dealId: string;

  beforeAll(async () => {
    const service = serviceClient();
    const { data: deal } = await service
      .from("deals")
      .select("id")
      .eq("type", "murabaha")
      .limit(1)
      .single();
    dealId = deal!.id;
  });

  it("the seeded deal's chain verifies end to end", async () => {
    const service = serviceClient();
    const { data, error } = await service.rpc("get_deal_event_chain", {
      p_deal_id: dealId,
    });
    expect(error).toBeNull();
    const rows = (data ?? []) as ChainRow[];
    expect(rows.length).toBeGreaterThan(0);
    expect(verifyChain(dealId, rows)).toEqual([]);
  });

  it("UPDATE and DELETE on deal_events are impossible even for parties", async () => {
    const financier = await signIn(FINANCIER);

    const { data: updated } = await financier
      .from("deal_events")
      .update({ event_type: "tampered" })
      .eq("deal_id", dealId)
      .select();
    expect(updated ?? []).toHaveLength(0);

    const { data: deleted } = await financier
      .from("deal_events")
      .delete()
      .eq("deal_id", dealId)
      .select();
    expect(deleted ?? []).toHaveLength(0);

    const service = serviceClient();
    const { data: still } = await service
      .from("deal_events")
      .select("event_type")
      .eq("deal_id", dealId);
    expect((still ?? []).some((e) => e.event_type === "tampered")).toBe(false);
    expect((still ?? []).length).toBeGreaterThan(0);
  });

  it("even the service role cannot UPDATE or DELETE events (trigger guard)", async () => {
    const service = serviceClient();
    const { error: updateError } = await service
      .from("deal_events")
      .update({ event_type: "tampered" })
      .eq("deal_id", dealId);
    expect(updateError).toBeTruthy();

    const { error: deleteError } = await service
      .from("deal_events")
      .delete()
      .eq("deal_id", dealId);
    expect(deleteError).toBeTruthy();
  });

  it("every state change appended an event and seq is dense from 1", async () => {
    const service = serviceClient();
    const { data } = await service
      .from("deal_events")
      .select("seq")
      .eq("deal_id", dealId)
      .order("seq");
    const seqs = (data ?? []).map((r) => r.seq);
    expect(seqs[0]).toBe(1);
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
  });
});

describe.skipIf(!up)("tripwire", () => {
  it("acknowledgements are recorded in tripwire_alerts", async () => {
    const service = serviceClient();
    const { data: org } = await service
      .from("organizations")
      .select("id")
      .limit(1)
      .single();
    const customer = await signIn(CUSTOMER);
    const { error } = await customer.rpc("acknowledge_tripwire", {
      p_org_id: org!.id,
      p_level: "amber",
      p_message: "integration-test acknowledgement",
    });
    expect(error).toBeNull();

    const {
      data: { user },
    } = await customer.auth.getUser();
    const { data: alerts } = await customer
      .from("tripwire_alerts")
      .select("*")
      .eq("user_id", user!.id)
      .eq("message", "integration-test acknowledgement");
    expect((alerts ?? []).length).toBe(1);
    expect(alerts![0].acknowledged_at).toBeTruthy();
  });
});
