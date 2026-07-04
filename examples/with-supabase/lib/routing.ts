// Regulatory routing: a pure, unit-tested function. The result is stamped on
// the deal at creation and logged as a deal_event. It produces an automated
// information notice — never legal advice (the note copy in content/routing.ts
// carries the mandatory disclaimer).

import type {
  BorrowerEntityType,
  DealPurpose,
  DealType,
  RegulatoryStatus,
  TripwireLevel,
} from "./types";

export type RoutingNoteKey =
  | "ltd_company_unregulated"
  | "first_time_regulated_non_commercial"
  | "repeat_needs_review"
  | "partnership_needs_review";

export interface RoutingInput {
  dealType: DealType;
  borrowerEntityType: BorrowerEntityType;
  purpose: DealPurpose;
  amountPence: number;
  /**
   * The financier's count of prior deals as financier, of the same deal type,
   * with status `active` or later (settled/defaulted/disputed/in_arbitration).
   * Cancelled and pre-active deals do not count.
   */
  financierPriorDealCount: number;
}

export interface RoutingResult {
  regulatoryStatus: RegulatoryStatus;
  noteKey: RoutingNoteKey;
  /** Tripwire to show before the deal can be created; null when none fires. */
  tripwire: TripwireLevel | null;
}

export function routeDeal(input: RoutingInput): RoutingResult {
  const { borrowerEntityType, financierPriorDealCount, dealType } = input;

  const tripwire = tripwireFor(dealType, financierPriorDealCount);

  if (borrowerEntityType === "ltd_company") {
    return {
      regulatoryStatus: "unregulated",
      noteKey: "ltd_company_unregulated",
      tripwire,
    };
  }

  if (borrowerEntityType === "partnership") {
    // Partnerships of 2 or 3 persons can fall inside the consumer credit
    // regime, so always route for review.
    return {
      regulatoryStatus: "needs_review",
      noteKey: "partnership_needs_review",
      tripwire,
    };
  }

  // sole_trader | individual
  if (financierPriorDealCount === 0) {
    return {
      regulatoryStatus: "regulated_non_commercial",
      noteKey: "first_time_regulated_non_commercial",
      tripwire,
    };
  }

  return {
    regulatoryStatus: "needs_review",
    noteKey: "repeat_needs_review",
    tripwire,
  };
}

/**
 * The frequency tripwire. Counts are per financier, per deal type:
 * - murabaha (financing): 2nd deal → amber blocking modal; 3rd+ → red blocking
 *   modal plus a governance alert visible to org admins.
 * - qard hasan counts separately and only triggers a softer informational
 *   notice at the 3rd loan.
 *
 * `priorDealCount` is the count of existing active-or-later deals, so the deal
 * being created is number `priorDealCount + 1`.
 */
export function tripwireFor(
  dealType: DealType,
  priorDealCount: number,
): TripwireLevel | null {
  const dealNumber = priorDealCount + 1;
  if (dealType === "qard_hasan") {
    return dealNumber >= 3 ? "qard_info" : null;
  }
  if (dealNumber >= 3) return "red";
  if (dealNumber === 2) return "amber";
  return null;
}
