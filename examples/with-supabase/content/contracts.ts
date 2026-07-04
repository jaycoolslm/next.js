// Template-grade contract text under English law (§8).
//
// TEMPLATE, NOT ADVICE. Every template is headed by the solicitor-review
// banner (see disclaimers.ts) and the contract pack carries the verbatim
// footer. These are drafting templates to record an agreement the parties have
// already reached; they are visibly flagged for solicitor review and must not
// be presented as bespoke legal advice.
//
// Placeholders use {{snake_case}} tokens. The app substitutes values (names,
// amounts formatted as GBP, dates formatted en-GB) before rendering. No
// placeholder ever introduces a penalty, interest, or late-charge amount — the
// only references to such concepts are the explicit EXCLUSION clauses below.
//
// Shariah structure (§5): murabaha is TWO contracts, kept as separate sections:
//   (a) a unilateral, non-binding promise to purchase;
//   (b) the financier's declaration of purchase and ownership (financier bears
//       asset risk);
//   (c) the murabaha sale contract (cost + disclosed markup, deferred
//       schedule, no late charges, early settlement with optional ibra').
// Qard hasan is principal only.

import { disclaimers } from "./disclaimers";

const REVIEW_BANNER =
  disclaimers["en-GB"].solicitorReviewBanner.title;

export interface ContractClause {
  /** Optional clause number, e.g. "1.1". */
  number?: string;
  /** Optional short heading. */
  heading?: string;
  /** Clause body. May contain {{snake_case}} placeholder tokens. */
  text: string;
}

export interface ContractSection {
  /** Stable key for referencing/ordering. */
  key: string;
  /** Section title. */
  title: string;
  /** Optional introductory sentence. */
  intro?: string;
  clauses: ContractClause[];
}

export interface ContractTemplate {
  /** Solicitor-review banner shown at the head of this template. */
  reviewBanner: string;
  /** Template title. */
  title: string;
  /** Parties line, with placeholders. */
  parties: string;
  /** Recitals / background. */
  recitals: string[];
  /** Ordered sections. */
  sections: ContractSection[];
}

// Shared arbitration clause — referenced by every template (§5, §8).
const arbitrationSection: ContractSection = {
  key: "arbitration",
  title: "Dispute resolution and arbitration",
  clauses: [
    {
      number: "1",
      text: "This agreement and any dispute or claim arising out of or in connection with it (including non-contractual disputes or claims) are governed by the law of England and Wales.",
    },
    {
      number: "2",
      text: "Any dispute arising out of or in connection with this agreement shall be referred to and finally resolved by arbitration under the Arbitration Act 1996. The seat of the arbitration shall be England and Wales, and the language of the arbitration shall be English.",
    },
    {
      number: "3",
      text: "The tribunal shall consist of a sole arbitrator. The parties shall seek to agree the identity of the sole arbitrator. Failing agreement within a reasonable period, the sole arbitrator shall be nominated in accordance with the nominating process of {{organisation_name}}, being {{arbitrator_nomination_process}}.",
    },
    {
      number: "4",
      text: "Nothing in this clause prevents either party from seeking to resolve the dispute amicably before commencing arbitration.",
    },
  ],
};

export interface MurabahaTemplate {
  /** (a) Unilateral, non-binding promise to purchase. */
  promiseToPurchase: ContractTemplate;
  /** (b) Financier's declaration of purchase and ownership. */
  purchaseDeclaration: ContractTemplate;
  /** (c) Murabaha sale contract. */
  saleContract: ContractTemplate;
}

export interface ContractsCopy {
  murabaha: MurabahaTemplate;
  qardHasan: ContractTemplate;
}

export const contracts: Record<"en-GB", ContractsCopy> = {
  "en-GB": {
    murabaha: {
      // (a) Non-binding promise ------------------------------------------------
      promiseToPurchase: {
        reviewBanner: REVIEW_BANNER,
        title: "Unilateral promise to purchase (non-binding)",
        parties:
          "This promise is recorded by {{customer_full_name}} (“the Prospective Purchaser”) in favour of {{financier_full_name}} (“the Financier”), members of {{organisation_name}}. Deal reference: {{deal_reference}}.",
        recitals: [
          "The Prospective Purchaser wishes to acquire the asset described below and has asked the Financier to consider purchasing it first so that it may afterwards be offered to the Prospective Purchaser under a separate murabaha sale.",
          "This document records only the Prospective Purchaser's expression of intent. It is deliberately structured to precede, and to be independent of, any purchase by the Financier and any later sale.",
        ],
        sections: [
          {
            key: "asset",
            title: "The asset",
            clauses: [
              {
                number: "1",
                text: "The asset to which this promise relates is: {{asset_description}}, expected to be sourced from {{supplier_name}}.",
              },
            ],
          },
          {
            key: "non-binding",
            title: "This promise is non-binding on both sides",
            clauses: [
              {
                number: "2.1",
                heading: "No obligation on the Prospective Purchaser",
                text: "This promise does not oblige the Prospective Purchaser to buy the asset. The Prospective Purchaser may decline to proceed at any time before a separate sale contract is made, and is under no liability for doing so.",
              },
              {
                number: "2.2",
                heading: "No obligation on the Financier",
                text: "This promise does not oblige the Financier to purchase the asset, to fund anything, or to offer any sale. The Financier may decline to proceed at any time and is under no liability for doing so.",
              },
              {
                number: "2.3",
                heading: "No contract of sale",
                text: "This document is not a contract of sale and creates no debt, price, or payment obligation. Any sale will arise only under the separate murabaha sale contract, made after the Financier has purchased and taken ownership of the asset.",
              },
            ],
          },
          {
            key: "recorded",
            title: "Record",
            clauses: [
              {
                number: "3",
                text: "Recorded on {{promise_date}} and entered in the ledger of {{organisation_name}} as part of deal reference {{deal_reference}}.",
              },
            ],
          },
        ],
      },
      // (b) Purchase and ownership declaration ---------------------------------
      purchaseDeclaration: {
        reviewBanner: REVIEW_BANNER,
        title: "Declaration of purchase and ownership by the Financier",
        parties:
          "This declaration is made by {{financier_full_name}} (“the Financier”), a member of {{organisation_name}}, in respect of deal reference {{deal_reference}}.",
        recitals: [
          "Following the Prospective Purchaser's non-binding promise, the Financier has itself purchased the asset before offering it for sale.",
        ],
        sections: [
          {
            key: "purchase",
            title: "Purchase and ownership",
            clauses: [
              {
                number: "1",
                text: "The Financier confirms that on {{purchase_date}} it purchased the following asset from {{supplier_name}}: {{asset_description}}, at a cost of {{cost_price}}.",
              },
              {
                number: "2",
                text: "The Financier confirms that it has taken ownership and possession (actual or constructive) of the asset, and that a receipt or other evidence of purchase has been recorded against deal reference {{deal_reference}}.",
              },
            ],
          },
          {
            key: "risk",
            title: "The Financier bears the risk of the asset",
            clauses: [
              {
                number: "3.1",
                text: "From the moment of purchase until the asset is sold to and accepted by the Purchaser under the separate murabaha sale contract, the Financier owns the asset and bears the risk in it, including the risk of loss, damage, or destruction and the burden of ownership.",
              },
              {
                number: "3.2",
                text: "The Financier is not acting merely as a lender of money. It is a seller of an asset it genuinely owns, and its entitlement under the later sale arises from that ownership and the risk it carries during this period.",
              },
            ],
          },
        ],
      },
      // (c) Murabaha sale contract ---------------------------------------------
      saleContract: {
        reviewBanner: REVIEW_BANNER,
        title: "Murabaha sale contract",
        parties:
          "This contract is made between {{financier_full_name}} (“the Seller”) and {{customer_full_name}} (“the Purchaser”), members of {{organisation_name}}. Deal reference: {{deal_reference}}.",
        recitals: [
          "The Seller owns the asset described below, having purchased it and borne the risk in it. The Seller now sells the asset to the Purchaser on a cost-plus (murabaha) basis, disclosing its cost and its markup, for a total price payable on deferred terms.",
          "This is a separate contract from the earlier non-binding promise. It is made only after the Seller's purchase and ownership, and only upon the Purchaser's acceptance recorded on {{sale_acceptance_date}}.",
        ],
        sections: [
          {
            key: "sale",
            title: "Sale and disclosed price",
            clauses: [
              {
                number: "1.1",
                text: "The Seller sells, and the Purchaser buys, the following asset: {{asset_description}}.",
              },
              {
                number: "1.2",
                heading: "Cost price",
                text: "The Seller's disclosed cost of the asset is {{cost_price}}.",
              },
              {
                number: "1.3",
                heading: "Markup",
                text: "The Seller's disclosed markup (profit) is {{markup}}.",
              },
              {
                number: "1.4",
                heading: "Total sale price",
                text: "The total sale price payable by the Purchaser is {{total_price}}, being the cost price plus the disclosed markup. This total is fixed and does not change once this contract is made.",
              },
            ],
          },
          {
            key: "schedule",
            title: "Deferred payment schedule",
            clauses: [
              {
                number: "2.1",
                text: "The total sale price is payable by deferred instalments: {{instalment_count}} instalment(s) of {{instalment_amount}} each, payable {{frequency}}, with the first instalment due on {{first_due_date}}.",
              },
              {
                number: "2.2",
                text: "Each payment recorded against deal reference {{deal_reference}} reduces the amount outstanding by the amount paid. The parties may confirm payments in the ledger; the ledger records payments but does not move money.",
              },
            ],
          },
          {
            key: "no-late-charges",
            title: "No late-payment charges of any kind",
            clauses: [
              {
                number: "3.1",
                text: "No amount of any kind may be added to the total sale price on account of late or missed payment. There are no late-payment charges, default charges, penalties, fees, interest, or increases of any description, and none may be demanded, recorded, or received. The total sale price is the most the Purchaser can ever owe under this contract.",
              },
              {
                number: "3.2",
                text: "If a payment is late, the amount outstanding remains unchanged. Any disagreement is to be resolved under the dispute-resolution clause below, not by any charge.",
              },
            ],
          },
          {
            key: "early-settlement",
            title: "Early settlement and optional rebate (ibra')",
            clauses: [
              {
                number: "4.1",
                text: "The Purchaser may settle early at any time by paying the amount then outstanding (the total sale price less payments already recorded). No charge or premium applies to early settlement.",
              },
              {
                number: "4.2",
                heading: "Ibra' at the Seller's sole discretion",
                text: "The Seller may, entirely at its own discretion, grant the Purchaser a rebate (ibra') reducing the amount payable on early settlement. Any such rebate is a voluntary act of the Seller. It is not promised, not a right of the Purchaser, and not a term the Purchaser can require. Where granted, it is recorded in the ledger as an event.",
              },
            ],
          },
          arbitrationSection,
        ],
      },
    },
    // Qard hasan ---------------------------------------------------------------
    qardHasan: {
      reviewBanner: REVIEW_BANNER,
      title: "Qard hasan (benevolent loan) agreement",
      parties:
        "This agreement is made between {{financier_full_name}} (“the Lender”) and {{customer_full_name}} (“the Borrower”), members of {{organisation_name}}. Deal reference: {{deal_reference}}.",
      recitals: [
        "The Lender agrees to lend, and the Borrower agrees to repay, a sum of money as a benevolent loan (qard hasan). The loan is of principal only. The Lender takes no benefit from it.",
      ],
      sections: [
        {
          key: "loan",
          title: "The loan",
          clauses: [
            {
              number: "1.1",
              text: "The Lender lends the Borrower the principal sum of {{principal}}.",
            },
            {
              number: "1.2",
              text: "The Borrower agrees to repay the principal by {{instalment_count}} instalment(s) of {{instalment_amount}} each, payable {{frequency}}, with the first payment due on {{first_due_date}}.",
            },
          ],
        },
        {
          key: "principal-only",
          title: "Principal only — nothing above principal is payable or recordable",
          clauses: [
            {
              number: "2.1",
              text: "The only sum owed is the principal of {{principal}}. No interest, profit, markup, fee, charge, benefit, or amount of any kind above the principal is payable to the Lender, and none may be demanded, agreed, recorded, or received. The most the Borrower can ever owe is the principal.",
            },
            {
              number: "2.2",
              text: "This structure makes any benefit to the Lender impossible to record. If a payment is late, the amount owed remains the outstanding principal and nothing is added. Any disagreement is to be resolved under the dispute-resolution clause below.",
            },
            {
              number: "2.3",
              heading: "Voluntary gift kept separate",
              text: "Any gift the Borrower may choose to make is entirely voluntary, is not a condition of the loan, is not promised in advance, and forms no part of this agreement.",
            },
          ],
        },
        arbitrationSection,
      ],
    },
  },
} as const;

export default contracts;
