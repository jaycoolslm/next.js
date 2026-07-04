"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/email";
import { routeDeal } from "@/lib/routing";
import { routing, tripwire as tripwireCopy } from "@/content";
import { getContractPackData } from "@/lib/contract/data";
import { renderContractPackHtml } from "@/lib/contract/render";
import { dealRef } from "@/lib/format";
import type { DealAction } from "@/lib/deals/state-machine";
import type {
  BorrowerEntityType,
  DealPurpose,
  DealType,
  ScheduleFrequency,
  TripwireLevel,
} from "@/lib/types";
import type { ActionResult } from "./invitations";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

export interface NewDealInput {
  orgId: string;
  type: DealType;
  /** Whether the current user is the financier or the customer. */
  myRole: "financier" | "customer";
  counterpartyEmail: string;
  // murabaha
  assetDescription?: string;
  supplierName?: string;
  costPricePence?: number;
  markupPence?: number;
  // qard hasan
  principalPence?: number;
  // schedule
  instalmentCount: number;
  instalmentAmountPence: number;
  firstDueDate: string;
  frequency: ScheduleFrequency;
  // routing
  borrowerEntityType: BorrowerEntityType;
  purpose: DealPurpose;
  // arbitration (optional nomination)
  arbitratorName?: string;
  arbitratorContact?: string;
  /** Set when a blocking tripwire modal was acknowledged in the wizard. */
  tripwireAcknowledged?: TripwireLevel;
}

/**
 * Pre-creation routing check for the wizard: returns the regulatory routing
 * result, the note text, and any tripwire the financier must see.
 */
export async function previewRoutingAction(
  type: DealType,
  myRole: "financier" | "customer",
  orgId: string,
  counterpartyEmail: string,
  borrowerEntityType: BorrowerEntityType,
  purpose: DealPurpose,
  amountPence: number,
): Promise<
  ActionResult<{
    regulatoryStatus: string;
    note: string;
    tripwire: TripwireLevel | null;
    tripwireBody?: string;
  }>
> {
  try {
    const supabase = await createClient();
    // The financier whose history matters may be the counterparty.
    let financierCount = 0;
    if (myRole === "financier") {
      const { data, error } = await supabase.rpc("get_financier_deal_count", {
        p_type: type,
      });
      if (error) return { ok: false, error: error.message };
      financierCount = Number(data?.count ?? 0);
    } else {
      const { data: member, error } = await supabase.rpc(
        "find_org_member_by_email",
        { p_org_id: orgId, p_email: counterpartyEmail.trim().toLowerCase() },
      );
      if (error) return { ok: false, error: error.message };
      const { data, error: countError } = await supabase.rpc(
        "get_financier_deal_count",
        { p_type: type, p_user_id: member.user_id },
      );
      if (countError) return { ok: false, error: countError.message };
      financierCount = Number(data?.count ?? 0);
    }

    const result = routeDeal({
      dealType: type,
      borrowerEntityType,
      purpose,
      amountPence,
      financierPriorDealCount: financierCount,
    });
    const note = routing["en-GB"].outcomes[result.noteKey].note;
    return {
      ok: true,
      data: {
        regulatoryStatus: result.regulatoryStatus,
        note,
        tripwire: result.tripwire,
        tripwireBody: result.tripwire
          ? tripwireCopy["en-GB"].levels[result.tripwire].body
          : undefined,
      },
    };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function createDealAction(
  input: NewDealInput,
): Promise<ActionResult<{ dealId: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in" };

    const { data: counterparty, error: lookupError } = await supabase.rpc(
      "find_org_member_by_email",
      {
        p_org_id: input.orgId,
        p_email: input.counterpartyEmail.trim().toLowerCase(),
      },
    );
    if (lookupError) return { ok: false, error: lookupError.message };

    const financierId =
      input.myRole === "financier" ? user.id : counterparty.user_id;
    const customerId =
      input.myRole === "customer" ? user.id : counterparty.user_id;

    const amountPence =
      input.type === "murabaha"
        ? (input.costPricePence ?? 0) + (input.markupPence ?? 0)
        : (input.principalPence ?? 0);

    // Re-run routing server-side; the stamped result never trusts the client.
    const { data: countData, error: countError } = await supabase.rpc(
      "get_financier_deal_count",
      {
        p_type: input.type,
        ...(input.myRole === "customer" ? { p_user_id: financierId } : {}),
      },
    );
    if (countError) return { ok: false, error: countError.message };
    const routingResult = routeDeal({
      dealType: input.type,
      borrowerEntityType: input.borrowerEntityType,
      purpose: input.purpose,
      amountPence,
      financierPriorDealCount: Number(countData?.count ?? 0),
    });
    const note = routing["en-GB"].outcomes[routingResult.noteKey].note;

    // A blocking tripwire must have been acknowledged in the wizard.
    const blocking =
      routingResult.tripwire === "amber" || routingResult.tripwire === "red";
    if (blocking && input.tripwireAcknowledged !== routingResult.tripwire) {
      return {
        ok: false,
        error: "You must acknowledge the notice before creating this deal.",
      };
    }

    const { data: dealId, error } = await supabase.rpc("create_deal", {
      p: {
        org_id: input.orgId,
        type: input.type,
        financier_id: financierId,
        customer_id: customerId,
        asset_description: input.assetDescription ?? null,
        supplier_name: input.supplierName ?? null,
        cost_price_pence: input.costPricePence ?? null,
        markup_pence: input.markupPence ?? null,
        principal_pence: input.principalPence ?? null,
        instalment_count: input.instalmentCount,
        instalment_amount_pence: input.instalmentAmountPence,
        first_due_date: input.firstDueDate,
        frequency: input.frequency,
        borrower_entity_type: input.borrowerEntityType,
        purpose: input.purpose,
        regulatory_status: routingResult.regulatoryStatus,
        routing_notes: note,
        arbitrator_name: input.arbitratorName ?? null,
        arbitrator_contact: input.arbitratorContact ?? null,
      },
    });
    if (error) return { ok: false, error: error.message };

    // Record the tripwire acknowledgement (also appends a deal event).
    if (routingResult.tripwire) {
      const level = routingResult.tripwire;
      const { error: ackError } = await supabase.rpc("acknowledge_tripwire", {
        p_org_id: input.orgId,
        p_level: level,
        p_message: tripwireCopy["en-GB"].levels[level].body,
        p_deal_id: dealId,
      });
      if (ackError) console.error("[282] tripwire ack failed:", ackError.message);
    }

    revalidatePath("/dashboard");
    return { ok: true, data: { dealId } };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/**
 * Advances the deal state machine. `begin_witnessing` first renders, hashes,
 * and stores the contract snapshot that witnesses will attest to.
 */
export async function advanceDealAction(
  dealId: string,
  action: DealAction,
  payload: Record<string, unknown> = {},
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    let rpcPayload = payload;

    if (action === "begin_witnessing") {
      const pack = await getContractPackData(supabase, dealId);
      if (!pack) return { ok: false, error: "Deal not found" };
      pack.milestones.witnessingStartedAt = pack.generatedAt;
      const html = renderContractPackHtml(pack);
      const sha256 = createHash("sha256").update(html).digest("hex");
      const storagePath = `${dealId}/${sha256}.html`;

      // The contract-snapshots bucket accepts no end-user writes; the server
      // stores the snapshot with the service role.
      const admin = createAdminClient();
      const { error: uploadError } = await admin.storage
        .from("contract-snapshots")
        .upload(storagePath, html, {
          contentType: "text/html; charset=utf-8",
          upsert: false,
        });
      if (uploadError) return { ok: false, error: uploadError.message };
      rpcPayload = {
        ...payload,
        snapshot_sha256: sha256,
        snapshot_path: storagePath,
      };
    }

    const { error } = await supabase.rpc("advance_deal", {
      p_deal_id: dealId,
      p_action: action,
      p_payload: rpcPayload,
    });
    if (error) return { ok: false, error: error.message };

    if (action === "raise_dispute") {
      await notifyCounterparty(
        dealId,
        "A dispute has been raised",
        `A dispute has been raised on deal ${dealRef(dealId)}. Sign in to review it: ${siteUrl()}/deals/${dealId}`,
      );
    }

    revalidatePath(`/deals/${dealId}`);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

async function notifyCounterparty(
  dealId: string,
  subject: string,
  text: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: deal } = await supabase
    .from("deals")
    .select("financier_id, customer_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal || !user) return;
  const otherId =
    deal.financier_id === user.id ? deal.customer_id : deal.financier_id;
  const { data: other } = await supabase
    .from("profiles")
    .select("email")
    .eq("user_id", otherId)
    .maybeSingle();
  if (other?.email) await sendMail({ to: other.email, subject, text });
}

/** Uploads a purchase receipt and registers it in the ledger. */
export async function uploadReceiptAction(
  dealId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Choose a file to upload" };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { ok: false, error: "File too large (10 MB max)" };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
    const storagePath = `${dealId}/receipts/${sha256.slice(0, 12)}-${safeName}`;

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("deal-documents")
      .upload(storagePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) return { ok: false, error: uploadError.message };

    const { error } = await supabase.rpc("add_deal_document", {
      p_deal_id: dealId,
      p_kind: "purchase_receipt",
      p_storage_path: storagePath,
      p_sha256: sha256,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/deals/${dealId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function addWitnessAction(
  dealId: string,
  orgId: string,
  email: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: member, error: lookupError } = await supabase.rpc(
      "find_org_member_by_email",
      { p_org_id: orgId, p_email: email.trim().toLowerCase() },
    );
    if (lookupError) return { ok: false, error: lookupError.message };

    const { error } = await supabase.rpc("add_deal_witness", {
      p_deal_id: dealId,
      p_witness_user_id: member.user_id,
    });
    if (error) return { ok: false, error: error.message };

    await sendMail({
      to: member.email,
      subject: "You have been asked to witness an agreement",
      text: [
        "As-salamu alaykum,",
        "",
        `You have been asked to witness an agreement (${dealRef(dealId)}) between two members of your organisation.`,
        "",
        `Review and attest here: ${siteUrl()}/witness/${dealId}`,
        "",
        "Witnessing records that you saw the parties agree to the recorded terms. You take on no financial obligation.",
      ].join("\n"),
    });

    revalidatePath(`/deals/${dealId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function recordRepaymentAction(
  dealId: string,
  amountPence: number,
  paidOn: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_repayment", {
      p_deal_id: dealId,
      p_amount_pence: amountPence,
      p_paid_on: paidOn,
      p_note: note ?? null,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/deals/${dealId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function confirmRepaymentAction(
  repaymentId: string,
  dealId: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("confirm_repayment", {
      p_repayment_id: repaymentId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/deals/${dealId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}
