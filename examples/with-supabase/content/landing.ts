// Static landing page copy (§9, §12).
//
// A single static page explaining what 282 is and — critically — what it is
// NOT. It MUST state explicitly that the platform lists no investment
// opportunities. No marketing of deals, no advice claims.

export interface LandingCopy {
  /** Product name. */
  name: string;
  /** One-line tagline. */
  tagline: string;
  /** Explanation of the name (Quran 2:282). */
  nameMeaning: string;
  /** What 282 is. */
  whatItIs: {
    heading: string;
    body: string;
  };
  /** What 282 is NOT — list of plain statements. */
  whatItIsNot: {
    heading: string;
    points: string[];
  };
  /** Invite-only note. */
  inviteOnly: {
    heading: string;
    body: string;
  };
  /** Closing note. */
  footerNote: string;
}

export const landing: Record<"en-GB", LandingCopy> = {
  "en-GB": {
    name: "282",
    tagline: "A ledger for recording and witnessing shariah-compliant private finance.",
    nameMeaning:
      "282 is named for Quran 2:282, the verse that commands believers to write down and to bring witnesses to a debt owed for a fixed term. That is all this tool does: it helps people who already know each other write down, witness, and keep evidence of an agreement.",
    whatItIs: {
      heading: "What 282 is",
      body: "282 is a record-keeping and witnessing ledger operated by your masjid. Community members who have already agreed a murabaha or a qard hasan between themselves use it to record the terms, invite two witnesses to attest, track repayments, and produce a clear, timestamped evidence pack. It keeps an append-only history so the sequence of what happened can be shown later.",
    },
    whatItIsNot: {
      heading: "What 282 is not",
      points: [
        "282 lists no investment opportunities. There is no marketplace, feed, directory, or search across deals, and nothing is ever advertised, matched, or recommended.",
        "282 never holds or moves money. It records what the parties tell it; every payment happens directly between the parties, outside the platform.",
        "282 is invite-only. There is no public signup. You can only take part if your masjid invites you, and you can only ever see deals you are part of.",
        "282 does not give legal, tax, or regulatory advice. It shows automated information notices and flags things for review, but it is not a substitute for a solicitor.",
        "282 is not a peer-to-peer platform, a payments product, a lender, or a broker.",
      ],
    },
    inviteOnly: {
      heading: "Invite-only, by design",
      body: "Access is granted by your masjid's administrators. If you have been invited, use the link in your invitation to set up your account. If you have not, there is nothing to browse — and that is deliberate.",
    },
    footerNote:
      "282 is operated by masjids as a community record-keeping tool. It provides no legal, tax, or regulatory advice and lists no investment opportunities.",
  },
} as const;

export default landing;
