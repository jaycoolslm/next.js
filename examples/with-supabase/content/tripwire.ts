// Frequency-tripwire modal copy (§6).
//
// The core warning sentence for the murabaha/finance tripwire is VERBATIM per
// §6 and MUST NOT be altered:
//   "Repeatedly providing finance may amount to lending by way of business,
//    which is a criminal offence without FCA authorisation. This is not legal
//    advice."
//
// Levels:
//   amber    — financier's 2nd deal as financier (blocking, must acknowledge)
//   red      — 3rd deal and beyond (same core warning; org admins notified)
//   qard_info — softer informational notice at the 3rd qard hasan loan

/** Verbatim core warning for the finance tripwire (§6). Reused by amber + red. */
export const TRIPWIRE_CORE_WARNING =
  "Repeatedly providing finance may amount to lending by way of business, which is a criminal offence without FCA authorisation. This is not legal advice.";

export type TripwireLevel = "amber" | "red" | "qard_info";

export interface TripwireModal {
  level: TripwireLevel;
  title: string;
  /** Full modal body. Blocking modals require acknowledgement to continue. */
  body: string;
  /** Label on the acknowledge / continue button. */
  acknowledgeLabel: string;
  /** Whether the modal blocks progress until acknowledged. */
  blocking: boolean;
}

export interface TripwireCopy {
  levels: Record<TripwireLevel, TripwireModal>;
}

export const tripwire: Record<"en-GB", TripwireCopy> = {
  "en-GB": {
    levels: {
      amber: {
        level: "amber",
        title: "Please read before you continue",
        body: `This is the second deal on which you are recorded as the financier. ${TRIPWIRE_CORE_WARNING} Recording your acknowledgement does not authorise the activity; it only confirms that you have read this notice.`,
        acknowledgeLabel: "I have read this notice and wish to continue",
        blocking: true,
      },
      red: {
        level: "red",
        title: "Important — this is at least your third deal as financier",
        body: `This is the third or a subsequent deal on which you are recorded as the financier. ${TRIPWIRE_CORE_WARNING} Because of the number of times you have provided finance, your organisation's administrators are being notified of this notice and your acknowledgement. Please consider taking your own advice before you proceed.`,
        acknowledgeLabel: "I understand and wish to continue",
        blocking: true,
      },
      qard_info: {
        level: "qard_info",
        title: "A note on repeated benevolent loans",
        body: "This is the third qard hasan (benevolent loan) you have recorded as the lender. Qard hasan is a loan of principal only, with no benefit to the lender. Recording benevolent loans regularly is generally different from providing finance for a return, but if the number or pattern of your lending grows you may wish to consider whether any authorisation or formalities could apply. This is an automated information notice, not legal advice. Consider consulting a solicitor.",
        acknowledgeLabel: "Got it",
        blocking: false,
      },
    },
  },
} as const;

export default tripwire;
