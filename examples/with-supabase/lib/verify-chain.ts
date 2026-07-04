// Hash-chain verification for deal_events. Pure logic (unit-tested); the CLI
// entry point lives in scripts/verify-chain.ts.
//
// The Postgres trigger computes, for each event:
//   hash = sha256(prev_hash || deal_id || seq || event_type
//                 || payload::text
//                 || to_char(created_at AT TIME ZONE 'UTC',
//                            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
// encoded as lowercase hex, with the genesis prev_hash being 64 zeros.
// get_deal_event_chain() returns payload/created_at as the exact strings the
// trigger consumed, so the verifier recomputes the digest byte for byte.

import { createHash } from "node:crypto";

export const GENESIS_HASH = "0".repeat(64);

export interface ChainRow {
  seq: number;
  actor_id: string | null;
  event_type: string;
  payload_text: string;
  created_at_text: string;
  prev_hash: string;
  hash: string;
}

export interface ChainProblem {
  seq: number;
  problem: string;
}

export function computeEventHash(dealId: string, row: ChainRow): string {
  return createHash("sha256")
    .update(
      row.prev_hash +
        dealId +
        String(row.seq) +
        row.event_type +
        row.payload_text +
        row.created_at_text,
    )
    .digest("hex");
}

export function verifyChain(dealId: string, rows: ChainRow[]): ChainProblem[] {
  const problems: ChainProblem[] = [];
  if (rows.length === 0) {
    problems.push({ seq: 0, problem: "no events found for this deal" });
    return problems;
  }
  let expectedPrev = GENESIS_HASH;
  let expectedSeq = 1;
  for (const row of rows) {
    if (row.seq !== expectedSeq) {
      problems.push({
        seq: row.seq,
        problem: `sequence gap: expected seq ${expectedSeq}, found ${row.seq}`,
      });
      expectedSeq = row.seq; // keep checking the rest of the chain
    }
    if (row.prev_hash !== expectedPrev) {
      problems.push({
        seq: row.seq,
        problem: `broken link: prev_hash ${row.prev_hash.slice(0, 12)}… does not match previous hash ${expectedPrev.slice(0, 12)}…`,
      });
    }
    const recomputed = computeEventHash(dealId, row);
    if (recomputed !== row.hash) {
      problems.push({
        seq: row.seq,
        problem: `hash mismatch: stored ${row.hash.slice(0, 12)}…, recomputed ${recomputed.slice(0, 12)}…`,
      });
    }
    expectedPrev = row.hash;
    expectedSeq += 1;
  }
  return problems;
}
