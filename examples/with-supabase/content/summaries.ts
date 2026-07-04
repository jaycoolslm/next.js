// Plain-English obligations summaries (§8 cover, deal detail).
//
// One summary per deal type. Each explains, in plain language: what each party
// owes and when, what the witnesses attest, and what happens on a dispute. No
// penalty or interest concept appears — the summaries state the total/principal
// is the most that can ever be owed.

export interface ObligationLine {
  /** Who this line is about, e.g. "The customer". */
  party: string;
  /** What they owe / must do. */
  obligation: string;
}

export interface DealSummary {
  /** Short heading. */
  title: string;
  /** One-line description of the arrangement. */
  overview: string;
  /** Who owes what, and when. */
  obligations: ObligationLine[];
  /** What the two witnesses attest to. */
  witnesses: string;
  /** What happens if the parties disagree. */
  dispute: string;
}

export interface SummariesCopy {
  murabaha: DealSummary;
  qardHasan: DealSummary;
}

export const summaries: Record<"en-GB", SummariesCopy> = {
  "en-GB": {
    murabaha: {
      title: "What this murabaha means in plain English",
      overview:
        "The financier buys an asset and owns it, then sells it to the customer at a disclosed cost-plus-markup price, payable over time. The markup is the financier's profit for buying the asset and carrying its risk — it is not interest, and the total price never changes.",
      obligations: [
        {
          party: "The financier",
          obligation:
            "Buys the asset first and genuinely owns it, bearing the risk of loss or damage until the customer accepts the sale. Then sells it at the disclosed total price and delivers it.",
        },
        {
          party: "The customer",
          obligation:
            "Once they accept the sale, pays the fixed total price by the agreed instalments, on the agreed dates. Nothing can ever be added to that total — there are no late charges of any kind. The customer may settle early at the amount outstanding.",
        },
        {
          party: "Both",
          obligation:
            "Record and confirm payments in the ledger. The financier may, entirely at its own choice, grant a rebate (ibra') on early settlement, but the customer cannot require one.",
        },
      ],
      witnesses:
        "Two witnesses each confirm that they saw the recorded terms and that the parties agreed to them. Their names, the time they attested, and a fingerprint of the exact document they reviewed are stored as evidence. Witnesses take on no financial obligation.",
      dispute:
        "If the parties disagree, either can move the deal to disputed, which notifies the other party. Unresolved disputes go to arbitration under the Arbitration Act 1996, seated in England and Wales, before a sole arbitrator. No charge is ever added because of a disagreement or delay.",
    },
    qardHasan: {
      title: "What this qard hasan means in plain English",
      overview:
        "A benevolent loan of money. The lender lends a sum and the borrower repays exactly that sum — nothing more. The lender takes no benefit of any kind.",
      obligations: [
        {
          party: "The lender",
          obligation:
            "Lends the agreed principal. Cannot ask for, agree, record, or receive anything above the principal.",
        },
        {
          party: "The borrower",
          obligation:
            "Repays the principal by the agreed instalments, on the agreed dates. The most they can ever owe is the principal; nothing is added if a payment is late.",
        },
        {
          party: "Both",
          obligation:
            "Record and confirm payments in the ledger. Any gift the borrower chooses to make is voluntary and forms no part of the loan.",
        },
      ],
      witnesses:
        "Two witnesses each confirm that they saw the recorded terms and that the parties agreed to them. Their names, the time they attested, and a fingerprint of the exact document they reviewed are stored as evidence. Witnesses take on no financial obligation.",
      dispute:
        "If the parties disagree, either can move the deal to disputed, which notifies the other party. Unresolved disputes go to arbitration under the Arbitration Act 1996, seated in England and Wales, before a sole arbitrator. The amount in question is always limited to the outstanding principal.",
    },
  },
} as const;

export default summaries;
