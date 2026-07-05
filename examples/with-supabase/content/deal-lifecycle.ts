// Short UI copy for the deal lifecycle (§5, §9 deal detail).
//
// These strings appear inline in the deal timeline, banners, and status chips.
// They explain each step of the shariah-critical sequence in plain language,
// stress that the promise and the sale are SEPARATE contracts, and describe
// terminal statuses. No penalty or interest concept appears anywhere.

import type { DealAction } from "@/lib/deals/state-machine";
import type { DealStatus } from "@/lib/types";

export interface Explainer {
  title: string;
  body: string;
}

export interface StatusDescription {
  /** Short label for a status chip. */
  label: string;
  /** One-line description. */
  description: string;
}

export interface DealLifecycleCopy {
  /** Non-binding promise to purchase (murabaha step 1). */
  promise: Explainer;
  /** Ownership window banner (murabaha step 3) — financier bears asset risk. */
  ownershipWindow: Explainer;
  /** Sale offer explainer (murabaha step 4) — a separate contract. */
  saleOffer: Explainer;
  /** Witnessing explainer. */
  witnessing: Explainer;
  /** Dispute explainer. */
  dispute: Explainer;
  /** Arbitration explainer. */
  arbitration: Explainer;
  /** Terminal / notable status descriptions. */
  statuses: {
    cancelled: StatusDescription;
    settled: StatusDescription;
    defaulted: StatusDescription;
  };
}

export const dealLifecycle: Record<"en-GB", DealLifecycleCopy> = {
  "en-GB": {
    promise: {
      title: "A non-binding promise to purchase",
      body: "This first step records only that the customer would like to buy the asset. It is not a sale and it does not bind either side. The customer is free not to proceed, and the financier is free not to buy or to offer anything. A sale can only happen later, under a separate contract.",
    },
    ownershipWindow: {
      title: "The financier owns the asset and bears the risk",
      body: "During this window the financier has bought the asset and genuinely owns it. The financier bears the risk in the asset — including loss or damage — until the customer accepts the sale. This ownership and risk is what makes the later markup a genuine profit on a sale rather than a charge for lending.",
    },
    saleOffer: {
      title: "A separate sale offer",
      body: "This sale is a new, separate contract from the earlier promise. Now that the financier owns the asset, it offers to sell it to the customer at the disclosed cost plus markup, payable over the agreed schedule. The customer chooses whether to accept.",
    },
    witnessing: {
      title: "Two witnesses confirm the agreement",
      body: "Before the deal becomes active, two witnesses each review the recorded terms and attest that the parties agreed to them. Once both have attested, the deal becomes active and everyone is emailed the contract pack.",
    },
    dispute: {
      title: "Raising a dispute",
      body: "Either party can mark the deal as disputed. This notifies the other party. Raising a dispute never adds any charge; the amount owed stays exactly as recorded while the matter is worked through.",
    },
    arbitration: {
      title: "Arbitration",
      body: "If a dispute cannot be resolved between the parties, it goes to arbitration under the Arbitration Act 1996, seated in England and Wales, before a single arbitrator the parties agree on (or one nominated through the organisation's process if they cannot agree). The arbitrator's decision is final.",
    },
    statuses: {
      cancelled: {
        label: "Cancelled",
        description:
          "The deal was stopped before it became active. No sale or loan took effect and nothing is owed.",
      },
      settled: {
        label: "Settled",
        description:
          "All payments have been recorded and confirmed. Nothing further is owed and the record is closed.",
      },
      defaulted: {
        label: "Defaulted",
        description:
          "The financier has recorded that the agreed payments were not completed. This is a record of what happened; no charge is added and the amount owed remains exactly as recorded.",
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Guided view copy (§9 deal detail, "Guided" direction).
//
// One imperative, plain-English "hero" line per pending action, plus a short
// supporting line. Support lines may contain tokens the view fills from deal
// data: {financier} {customer} {price} {cost} {markup} {count} {instalment}
// {first}. Kept deliberately terse — deeper context lives behind disclosures.
// ---------------------------------------------------------------------------

export interface GuidedStep {
  /** Small eyebrow above the headline, e.g. "Your turn". */
  kicker: string;
  /** The one imperative headline. */
  headline: string;
  /** At most one short supporting line (may contain {tokens}). */
  support: string;
}

export interface GuidedLifecycleCopy {
  /** Hero copy when the viewer has this action to take, keyed by action. */
  actions: Partial<Record<DealAction, GuidedStep>>;
  /** Hero copy when the viewer is waiting or the deal is at rest, by status. */
  waiting: Partial<Record<DealStatus, GuidedStep>>;
  /** "Why this step" disclosure per pending action. */
  why: Partial<Record<DealAction, Explainer>>;
  /** "Why this step" disclosure when at rest, keyed by status. */
  whyStatus: Partial<Record<DealStatus, Explainer>>;
}

const en = dealLifecycle["en-GB"];

export const guidedLifecycle: Record<"en-GB", GuidedLifecycleCopy> = {
  "en-GB": {
    actions: {
      record_promise: {
        kicker: "First step",
        headline: "Record the promise",
        support: "Note that {customer} would like to buy — nothing binds yet.",
      },
      record_purchase: {
        kicker: "Your turn",
        headline: "Confirm your purchase",
        support: "Record that you bought the asset and now own it.",
      },
      offer_sale: {
        kicker: "Your turn",
        headline: "Offer the sale",
        support: "Sell it to {customer} at {price}, over {count} months.",
      },
      accept_sale: {
        kicker: "Your turn",
        headline: "Accept the sale",
        support: "Agree to buy at {price}, payable over {count} months.",
      },
      offer_terms: {
        kicker: "Your turn",
        headline: "Offer the loan",
        support: "Lend {price} to {customer}, repayable over {count} months.",
      },
      accept_terms: {
        kicker: "Your turn",
        headline: "Accept the loan",
        support: "Agree to repay {price} — never a penny more.",
      },
      begin_witnessing: {
        kicker: "Your turn",
        headline: "Bring in the witnesses",
        support: "Freeze the terms so two witnesses can attest.",
      },
    },
    waiting: {
      draft: {
        kicker: "Draft",
        headline: "Not started yet",
        support: "This deal is still being prepared.",
      },
      promise_recorded: {
        kicker: "In progress",
        headline: "Waiting on the financier",
        support: "{financier} needs to buy the asset next.",
      },
      financier_purchased: {
        kicker: "In progress",
        headline: "Waiting on {financier}",
        support: "They've bought the asset and will offer you the sale.",
      },
      ownership_window: {
        kicker: "In progress",
        headline: "Waiting on {financier}",
        support: "They own the asset and will offer you the sale next.",
      },
      sale_accepted: {
        kicker: "In progress",
        headline: "Ready to witness",
        support: "The sale is agreed — witnessing comes next.",
      },
      accepted: {
        kicker: "In progress",
        headline: "Ready to witness",
        support: "The terms are agreed — witnessing comes next.",
      },
      sale_offered: {
        kicker: "In progress",
        headline: "Waiting on {customer}",
        support: "They need to accept the sale offer.",
      },
      offered: {
        kicker: "In progress",
        headline: "Waiting on {customer}",
        support: "They need to accept the loan terms.",
      },
      witnessing: {
        kicker: "In progress",
        headline: "Witnessing under way",
        support: "Two witnesses are reviewing the frozen terms.",
      },
      active: {
        kicker: "Active",
        headline: "Financing is live",
        support: "Record repayments below as they arrive.",
      },
      disputed: {
        kicker: "On hold",
        headline: "This deal is in dispute",
        support: "The amount owed is unchanged while it's resolved.",
      },
      in_arbitration: {
        kicker: "On hold",
        headline: "In arbitration",
        support: "An arbitrator will decide. Nothing is added.",
      },
      settled: {
        kicker: "Complete",
        headline: "Settled in full",
        support: "All payments recorded. Nothing more is owed.",
      },
      cancelled: {
        kicker: "Closed",
        headline: "Deal cancelled",
        support: "It was stopped before it took effect. Nothing is owed.",
      },
      defaulted: {
        kicker: "Closed",
        headline: "Recorded as defaulted",
        support: "A record of what happened. No charge is added.",
      },
    },
    why: {
      record_promise: en.promise,
      record_purchase: en.ownershipWindow,
      offer_sale: en.saleOffer,
      accept_sale: en.saleOffer,
      offer_terms: {
        title: "A benevolent loan (qard hasan)",
        body: "A qard hasan is an interest-free loan. You lend the principal and can never ask for, agree to, or receive anything above it. Offering the terms puts the agreed schedule on record for the borrower to accept.",
      },
      accept_terms: {
        title: "A benevolent loan (qard hasan)",
        body: "By accepting you agree to repay the principal on the recorded schedule. The most you can ever owe is the principal — nothing is added if a payment is late.",
      },
      begin_witnessing: en.witnessing,
    },
    whyStatus: {
      promise_recorded: en.ownershipWindow,
      financier_purchased: en.ownershipWindow,
      ownership_window: en.ownershipWindow,
      sale_offered: en.saleOffer,
      witnessing: en.witnessing,
      disputed: en.dispute,
      in_arbitration: en.arbitration,
      settled: {
        title: en.statuses.settled.label,
        body: en.statuses.settled.description,
      },
      cancelled: {
        title: en.statuses.cancelled.label,
        body: en.statuses.cancelled.description,
      },
      defaulted: {
        title: en.statuses.defaulted.label,
        body: en.statuses.defaulted.description,
      },
    },
  },
} as const;

export default dealLifecycle;
