// Usage: pnpm verify-chain <dealId>
//
// Verifies the append-only hash chain of a deal's event log end to end:
// contiguous seq from 1, prev_hash linkage, and a byte-for-byte sha256
// recomputation of every event hash. Reads env from .env.local / .env.
//
// Requires SUPABASE_SECRET_KEY (operator credential) so it can be run against
// any deal for audit purposes without a user session.

import { createClient } from "@supabase/supabase-js";
import { verifyChain, type ChainRow } from "../lib/verify-chain";

async function main() {
  const dealId = process.argv[2];
  if (!dealId) {
    console.error("Usage: pnpm verify-chain <dealId>");
    process.exit(2);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example).",
    );
    process.exit(2);
  }

  const supabase = createClient(url, secret, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc("get_deal_event_chain", {
    p_deal_id: dealId,
  });
  if (error) {
    console.error(`Failed to fetch event chain: ${error.message}`);
    process.exit(2);
  }

  const rows = (data ?? []) as ChainRow[];
  const problems = verifyChain(dealId, rows);

  console.log(`Deal ${dealId}: ${rows.length} event(s)`);
  for (const row of rows) {
    console.log(
      `  #${String(row.seq).padStart(3)}  ${row.created_at_text}  ${row.event_type}  ${row.hash.slice(0, 12)}…`,
    );
  }

  if (problems.length === 0) {
    console.log("\n✔ Hash chain verified: append-only history is intact.");
    process.exit(0);
  }

  console.error(`\n✘ Chain verification FAILED (${problems.length} problem(s)):`);
  for (const p of problems) {
    console.error(`  seq ${p.seq}: ${p.problem}`);
  }
  process.exit(1);
}

main();
