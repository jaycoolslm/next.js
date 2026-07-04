// Short UI copy for the deal lifecycle (§5, §9 deal detail).
//
// These strings appear inline in the deal timeline, banners, and status chips.
// They explain each step of the shariah-critical sequence in plain language,
// stress that the promise and the sale are SEPARATE contracts, and describe
// terminal statuses. No penalty or interest concept appears anywhere.

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

export default dealLifecycle;
