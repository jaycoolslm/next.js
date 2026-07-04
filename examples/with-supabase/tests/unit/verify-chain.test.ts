import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GENESIS_HASH,
  computeEventHash,
  verifyChain,
  type ChainRow,
} from "@/lib/verify-chain";

const DEAL_ID = "11111111-2222-3333-4444-555555555555";

function buildChain(
  events: Array<{ event_type: string; payload_text?: string }>,
): ChainRow[] {
  const rows: ChainRow[] = [];
  let prev = GENESIS_HASH;
  events.forEach((event, i) => {
    const row: ChainRow = {
      seq: i + 1,
      actor_id: null,
      event_type: event.event_type,
      payload_text: event.payload_text ?? "{}",
      created_at_text: `2026-01-0${i + 1}T12:00:00.000000Z`,
      prev_hash: prev,
      hash: "",
    };
    row.hash = computeEventHash(DEAL_ID, row);
    prev = row.hash;
    rows.push(row);
  });
  return rows;
}

describe("computeEventHash", () => {
  it("matches a hand-computed sha256 of the concatenated fields", () => {
    const row: ChainRow = {
      seq: 1,
      actor_id: null,
      event_type: "deal_created",
      payload_text: '{"type": "murabaha"}',
      created_at_text: "2026-01-01T12:00:00.000000Z",
      prev_hash: GENESIS_HASH,
      hash: "",
    };
    const expected = createHash("sha256")
      .update(
        GENESIS_HASH +
          DEAL_ID +
          "1" +
          "deal_created" +
          '{"type": "murabaha"}' +
          "2026-01-01T12:00:00.000000Z",
      )
      .digest("hex");
    expect(computeEventHash(DEAL_ID, row)).toBe(expected);
  });
});

describe("verifyChain", () => {
  it("accepts an intact chain", () => {
    const rows = buildChain([
      { event_type: "deal_created" },
      { event_type: "routing_stamped" },
      { event_type: "promise_recorded" },
    ]);
    expect(verifyChain(DEAL_ID, rows)).toEqual([]);
  });

  it("detects a tampered payload", () => {
    const rows = buildChain([
      { event_type: "deal_created" },
      { event_type: "repayment_recorded", payload_text: '{"amount_pence": 100}' },
    ]);
    rows[1].payload_text = '{"amount_pence": 999999}';
    const problems = verifyChain(DEAL_ID, rows);
    expect(problems.some((p) => p.problem.includes("hash mismatch"))).toBe(true);
  });

  it("detects a deleted event (sequence gap and broken link)", () => {
    const rows = buildChain([
      { event_type: "deal_created" },
      { event_type: "promise_recorded" },
      { event_type: "purchase_recorded" },
    ]);
    rows.splice(1, 1);
    const problems = verifyChain(DEAL_ID, rows);
    expect(problems.some((p) => p.problem.includes("sequence gap"))).toBe(true);
    expect(problems.some((p) => p.problem.includes("broken link"))).toBe(true);
  });

  it("detects a rewritten hash that does not chain forward", () => {
    const rows = buildChain([
      { event_type: "deal_created" },
      { event_type: "promise_recorded" },
    ]);
    rows[0].hash = "a".repeat(64);
    const problems = verifyChain(DEAL_ID, rows);
    expect(problems.length).toBeGreaterThan(0);
  });

  it("reports an empty chain", () => {
    expect(verifyChain(DEAL_ID, [])).toHaveLength(1);
  });
});
