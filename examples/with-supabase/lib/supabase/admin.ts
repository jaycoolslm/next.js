import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server-only: bypasses RLS. Used exclusively for
 * (1) invitation-gated account creation — public signup is disabled at the
 * auth layer — and (2) writing contract snapshots to the private
 * contract-snapshots bucket. Everything user-facing goes through the
 * RLS-scoped clients in client.ts / server.ts.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error(
      "SUPABASE_SECRET_KEY (and NEXT_PUBLIC_SUPABASE_URL) must be set — see .env.example",
    );
  }
  return createSupabaseClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
