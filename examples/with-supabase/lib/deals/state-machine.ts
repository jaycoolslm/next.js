// TypeScript mirror of the Postgres deal state machine. The database function
// advance_deal() is the enforcement point; this module exists so the UI can
// know which actions to offer without a round trip. Keep in sync with
// supabase/migrations (state machine migration).

import type { DealStatus, DealType } from "../types";

export type DealAction =
  // murabaha (order is shariah-critical; timestamps are the evidence)
  | "record_promise"
  | "record_purchase"
  | "offer_sale"
  | "accept_sale"
  // qard hasan
  | "offer_terms"
  | "accept_terms"
  // shared
  | "begin_witnessing"
  | "cancel"
  | "raise_dispute"
  | "move_to_arbitration"
  | "settle"
  | "mark_defaulted"
  | "grant_ibra";

export type ActorRole = "financier" | "customer";

interface TransitionSpec {
  from: DealStatus;
  to: DealStatus | null; // null = no status change (grant_ibra)
  /** Which party may perform it; undefined = either party. */
  actor?: ActorRole;
}

const MURABAHA_TRANSITIONS: Partial<Record<DealAction, TransitionSpec>> = {
  record_promise: { from: "draft", to: "promise_recorded", actor: "customer" },
  // record_purchase appends two events and lands on ownership_window
  record_purchase: {
    from: "promise_recorded",
    to: "ownership_window",
    actor: "financier",
  },
  offer_sale: {
    from: "ownership_window",
    to: "sale_offered",
    actor: "financier",
  },
  accept_sale: { from: "sale_offered", to: "sale_accepted", actor: "customer" },
  begin_witnessing: { from: "sale_accepted", to: "witnessing" },
};

const QARD_TRANSITIONS: Partial<Record<DealAction, TransitionSpec>> = {
  offer_terms: { from: "draft", to: "offered", actor: "financier" },
  accept_terms: { from: "offered", to: "accepted", actor: "customer" },
  begin_witnessing: { from: "accepted", to: "witnessing" },
};

export const PRE_ACTIVE_STATUSES: DealStatus[] = [
  "draft",
  "promise_recorded",
  "financier_purchased",
  "ownership_window",
  "sale_offered",
  "sale_accepted",
  "offered",
  "accepted",
  "witnessing",
];

export const TERMINAL_STATUSES: DealStatus[] = [
  "settled",
  "defaulted",
  "cancelled",
];

function sharedTransitions(status: DealStatus): Partial<
  Record<DealAction, TransitionSpec>
> {
  const shared: Partial<Record<DealAction, TransitionSpec>> = {};
  if (PRE_ACTIVE_STATUSES.includes(status)) {
    shared.cancel = { from: status, to: "cancelled" };
  }
  if (status === "active") {
    shared.raise_dispute = { from: "active", to: "disputed" };
  }
  if (status === "disputed") {
    shared.move_to_arbitration = { from: "disputed", to: "in_arbitration" };
  }
  if (status === "active" || status === "in_arbitration") {
    shared.settle = { from: status, to: "settled", actor: "financier" };
    shared.mark_defaulted = { from: status, to: "defaulted", actor: "financier" };
    shared.grant_ibra = { from: status, to: null, actor: "financier" };
  }
  return shared;
}

/** All actions available on a deal in `status`, optionally filtered by role. */
export function availableActions(
  type: DealType,
  status: DealStatus,
  role?: ActorRole,
): DealAction[] {
  const typed = type === "murabaha" ? MURABAHA_TRANSITIONS : QARD_TRANSITIONS;
  const all = { ...sharedTransitions(status) };
  for (const [action, spec] of Object.entries(typed)) {
    if (spec.from === status) all[action as DealAction] = spec;
  }
  return (Object.entries(all) as [DealAction, TransitionSpec][])
    .filter(([, spec]) => spec.from === status)
    .filter(([, spec]) => !role || !spec.actor || spec.actor === role)
    .map(([action]) => action);
}

export function isActionAllowed(
  type: DealType,
  status: DealStatus,
  action: DealAction,
  role?: ActorRole,
): boolean {
  return availableActions(type, status, role).includes(action);
}

/** Ordered status sequence used to render the deal timeline. */
export function lifecycleFor(type: DealType): DealStatus[] {
  return type === "murabaha"
    ? [
        "draft",
        "promise_recorded",
        "financier_purchased",
        "ownership_window",
        "sale_offered",
        "sale_accepted",
        "witnessing",
        "active",
        "settled",
      ]
    : ["draft", "offered", "accepted", "witnessing", "active", "settled"];
}
