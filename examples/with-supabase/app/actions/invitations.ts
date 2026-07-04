"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/email";
import type { OrgRole } from "@/lib/types";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

/**
 * Org admin creates an invitation. The raw token exists only in the invite
 * email (and is returned once for display); only its sha256 hash is stored.
 */
export async function createInvitationAction(
  orgId: string,
  email: string,
  role: OrgRole,
): Promise<ActionResult<{ inviteUrl: string }>> {
  try {
    const supabase = await createClient();
    const { data: token, error } = await supabase.rpc("create_invitation", {
      p_org_id: orgId,
      p_email: email.trim().toLowerCase(),
      p_role: role,
    });
    if (error) return { ok: false, error: error.message };

    const inviteUrl = `${siteUrl()}/auth/accept-invitation?token=${token}`;
    await sendMail({
      to: email,
      subject: "You have been invited to 282",
      text: [
        "As-salamu alaykum,",
        "",
        "You have been invited to join 282, your organisation's private ledger for recording and witnessing deals.",
        "",
        `Accept your invitation: ${inviteUrl}`,
        "",
        "This link expires; if it has expired, ask your organisation's admin for a new invitation.",
        "282 never holds or moves money and lists no investment opportunities.",
      ].join("\n"),
    });
    revalidatePath("/admin");
    return { ok: true, data: { inviteUrl } };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** Looks up an invitation by raw token. Service role (no anon DB access). */
export async function validateInvitationAction(
  token: string,
): Promise<ActionResult<{ orgName: string; email: string; role: OrgRole }>> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("validate_invitation", {
      p_token: token,
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      data: {
        orgName: data.org_name,
        email: data.email,
        role: data.role,
      },
    };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/**
 * Invitation-gated signup. Public signup is disabled at the auth layer
 * (supabase/config.toml), so account creation happens here with the service
 * role — strictly after the invitation token checks out.
 */
export async function acceptInvitationSignupAction(
  token: string,
  fullName: string,
  password: string,
): Promise<ActionResult> {
  try {
    const admin = createAdminClient();
    const { data: invite, error: inviteError } = await admin.rpc(
      "validate_invitation",
      { p_token: token },
    );
    if (inviteError) return { ok: false, error: inviteError.message };

    const { error: createError } = await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName.trim() },
    });
    if (createError && !createError.message.includes("already been registered")) {
      return { ok: false, error: createError.message };
    }

    // Sign in with the RLS-scoped client so the session cookie is set.
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password,
    });
    if (signInError) return { ok: false, error: signInError.message };

    const { error: acceptError } = await supabase.rpc("accept_invitation", {
      p_token: token,
    });
    if (acceptError) return { ok: false, error: acceptError.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** A signed-in user accepting an invitation to a further organisation. */
export async function acceptInvitationExistingAction(
  token: string,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("accept_invitation", {
      p_token: token,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}
