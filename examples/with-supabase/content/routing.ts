// Regulatory routing notes (§6).
//
// One note per routing outcome. The note is stamped on the deal, logged as an
// event, and shown in the UI. EVERY note ends with the standard disclaimer
// sentence (composed here so it stays verbatim and in sync with
// disclaimers.ts). The two notes quoted verbatim in §6 (ltd_company and the
// first-time individual/sole-trader case) appear here exactly as specified.

import { STANDARD_DISCLAIMER } from "./disclaimers";

export type RoutingOutcome =
  | "ltd_company_unregulated"
  | "first_time_regulated_non_commercial"
  | "repeat_needs_review"
  | "partnership_needs_review";

export interface RoutingNote {
  /** Machine label mirroring the deal's regulatory_status. */
  regulatoryStatus: "unregulated" | "regulated_non_commercial" | "needs_review";
  /** Short heading for the routing card. */
  heading: string;
  /**
   * The full note shown to the user and stored in `routing_notes`. Always ends
   * with the standard disclaimer sentence.
   */
  note: string;
}

export interface RoutingCopy {
  outcomes: Record<RoutingOutcome, RoutingNote>;
}

// Composition helper: guarantees each note terminates with the verbatim
// standard disclaimer, separated by a single space.
function withDisclaimer(body: string): string {
  return `${body} ${STANDARD_DISCLAIMER}`;
}

export const routing: Record<"en-GB", RoutingCopy> = {
  "en-GB": {
    outcomes: {
      // VERBATIM note per §6 (ltd company), followed by the standard disclaimer.
      ltd_company_unregulated: {
        regulatoryStatus: "unregulated",
        heading: "Lending to a limited company",
        note: withDisclaimer(
          "Consumer credit protections apply to individuals; lending to a limited company is outside the consumer credit regime.",
        ),
      },
      // VERBATIM note per §6 (first-time individual/sole trader), followed by
      // the standard disclaimer.
      first_time_regulated_non_commercial: {
        regulatoryStatus: "regulated_non_commercial",
        heading: "Likely a regulated, non-commercial agreement",
        note: withDisclaimer(
          "This is likely a regulated credit agreement. A one-off private financier not acting by way of business generally needs no FCA authorisation and the agreement is likely a non-commercial agreement, but formalities may still apply.",
        ),
      },
      repeat_needs_review: {
        regulatoryStatus: "needs_review",
        heading: "Needs review — you have financed before",
        note: withDisclaimer(
          "Our records show you have provided finance before. Providing finance more than once may indicate lending by way of business, which can require FCA authorisation and carries criminal liability if carried on without it. This arrangement should be reviewed before you proceed.",
        ),
      },
      partnership_needs_review: {
        regulatoryStatus: "needs_review",
        heading: "Needs review — borrower is a partnership",
        note: withDisclaimer(
          "The borrower is a partnership. A partnership of two or three persons can fall inside the consumer credit regime, so consumer credit protections and formalities may apply. This arrangement should be reviewed before you proceed.",
        ),
      },
    },
  },
} as const;

export default routing;
