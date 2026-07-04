"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/email";
import { dealRef } from "@/lib/format";
import type { ActionResult } from "./invitations";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

/**
 * Sends the witness a 6-digit email OTP (Supabase auth). The witness is
 * already signed in; the OTP proves live control of the mailbox at the moment
 * of attestation.
 */
export async function requestAttestationOtpAction(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return { ok: false, error: "Not signed in" };

    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/**
 * Verifies the OTP and records the attestation. The database function
 * (attest_deal) re-checks: caller is an invited witness and not a party, the
 * deal is in `witnessing`, and the sha matches the stored snapshot. The deal
 * auto-advances to `active` on the second attestation, at which point all
 * parties are emailed a link to the contract pack.
 */
export async function attestDealAction(
  dealId: string,
  otp: string,
  typedFullName: string,
  snapshotSha256: string,
): Promise<ActionResult<{ newStatus: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return { ok: false, error: "Not signed in" };

    const { error: otpError } = await supabase.auth.verifyOtp({
      email: user.email,
      token: otp.trim(),
      type: "email",
    });
    if (otpError) {
      return { ok: false, error: `Code verification failed: ${otpError.message}` };
    }

    // OTP has now been verified for this witness in this request. Record the
    // attestation with the SERVICE ROLE: attest_deal is not callable by
    // `authenticated`, so this server action is the only path to an
    // attestation, and the OTP gate above cannot be bypassed by a witness
    // hitting the RPC directly. attest_deal still re-checks eligibility
    // (invited, not a party, snapshot match), so the elevated client cannot
    // attest an ineligible person.
    const otpVerifiedAt = new Date().toISOString();
    const headerList = await headers();
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("attest_deal", {
      p_deal_id: dealId,
      p_witness_user_id: user.id,
      p_typed_full_name: typedFullName.trim(),
      p_snapshot_sha256: snapshotSha256,
      p_otp_verified_at: otpVerifiedAt,
      p_user_agent: headerList.get("user-agent") ?? null,
    });
    if (error) return { ok: false, error: error.message };

    const newStatus = String(data?.status ?? "witnessing");
    if (newStatus === "active") {
      await emailContractPackToParties(dealId);
    }

    revalidatePath(`/deals/${dealId}`);
    revalidatePath("/dashboard");
    return { ok: true, data: { newStatus } };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

async function emailContractPackToParties(dealId: string) {
  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("financier_id, customer_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return;
  const { data: parties } = await supabase
    .from("profiles")
    .select("email, full_name")
    .in("user_id", [deal.financier_id, deal.customer_id]);
  for (const party of parties ?? []) {
    if (!party.email) continue;
    await sendMail({
      to: party.email,
      subject: `Your agreement ${dealRef(dealId)} is now witnessed and active`,
      text: [
        "As-salamu alaykum,",
        "",
        `Both witnesses have attested and your agreement ${dealRef(dealId)} is now active.`,
        "",
        `View and print the contract pack: ${siteUrl()}/deals/${dealId}/contract`,
        "",
        "Keep a copy for your records. This document is a template and record, not legal advice.",
      ].join("\n"),
    });
  }
}
