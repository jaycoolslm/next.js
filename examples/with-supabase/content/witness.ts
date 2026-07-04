// Witness ceremony copy (§7).
//
// The ayah (Quran 2:282) is quoted only as the pertinent excerpt concerning
// the recording and witnessing of deferred debts. The English rendering is the
// Saheeh International translation; the translation is attributed wherever it
// is displayed. The Arabic excerpt is used on the contract-pack cover (§8).
//
// Witnessing is a ceremony, not a checkbox (§2.3): the review screen, the OTP
// step, the typed-name attestation, and the confirmation are all part of one
// deliberate flow.

export interface AyahCopy {
  /** Reference shown with the quotation. */
  reference: string;
  /** Arabic text of the pertinent excerpt (contract-pack cover, §8). */
  arabic: string;
  /** English translation of the pertinent excerpt. */
  translation: string;
  /** Translation attribution shown with the English text. */
  translationAttribution: string;
}

export interface WitnessCopy {
  ayah: AyahCopy;
  /** Intro shown at the top of the witness review screen. */
  reviewIntro: {
    title: string;
    body: string;
  };
  /** Copy for requesting the 6-digit email OTP. */
  otpRequest: {
    title: string;
    body: string;
    buttonLabel: string;
  };
  /** Copy for entering the received OTP. */
  otpEntry: {
    title: string;
    body: string;
    inputLabel: string;
    resendLabel: string;
  };
  /** The typed-name attestation step. */
  attestation: {
    title: string;
    /** Instruction shown above the name field. */
    instruction: string;
    nameFieldLabel: string;
    /**
     * The solemn declaration the witness affirms by typing their full legal
     * name. Presented immediately above the name field.
     */
    declaration: string;
    submitLabel: string;
  };
  /** Confirmation shown after a successful attestation. */
  confirmation: {
    title: string;
    body: string;
  };
}

export const witness: Record<"en-GB", WitnessCopy> = {
  "en-GB": {
    ayah: {
      reference: "Quran 2:282 (excerpt)",
      arabic:
        "يَـٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوٓا۟ إِذَا تَدَايَنتُم بِدَيْنٍ إِلَىٰٓ أَجَلٍۢ مُّسَمًّۭى فَٱكْتُبُوهُ ۚ … وَٱسْتَشْهِدُوا۟ شَهِيدَيْنِ مِن رِّجَالِكُمْ",
      translation:
        "O you who have believed, when you contract a debt for a specified term, write it down. … And bring to witness two witnesses from among your men.",
      translationAttribution: "Translation: Saheeh International.",
    },
    reviewIntro: {
      title: "You have been asked to witness this agreement",
      body: "Please read the summary and the full recorded terms below carefully before you attest. As a witness you are confirming what the parties agreed and that you saw these recorded terms — you are not a party to the agreement and you take on no financial obligation. The terms shown here are exactly what you will be attesting to; they will not change after you attest.",
    },
    otpRequest: {
      title: "Verify it is you",
      body: "To attest as a witness we will send a 6-digit code to your email address. This confirms your identity and is recorded with your attestation.",
      buttonLabel: "Send me a code",
    },
    otpEntry: {
      title: "Enter your code",
      body: "Enter the 6-digit code we just emailed you. The code expires shortly, so please enter it soon.",
      inputLabel: "6-digit code",
      resendLabel: "Resend the code",
    },
    attestation: {
      title: "Attest as a witness",
      instruction:
        "Type your full legal name exactly as you would sign it. By doing so you make the declaration below.",
      nameFieldLabel: "Your full legal name",
      declaration:
        "I confirm that I have read the recorded terms shown to me, and I solemnly witness that the parties named agreed to those terms. I understand that my name, the time of my attestation, and a fingerprint of the exact document I reviewed are being recorded as evidence, and that I am not a party to this agreement.",
      submitLabel: "Attest with my name",
    },
    confirmation: {
      title: "Thank you — your attestation is recorded",
      body: "Your attestation has been added to the deal's permanent record, along with the time and a fingerprint of the document you reviewed. When the second witness has attested, all parties will be emailed a link to the completed contract pack. You do not need to do anything further.",
    },
  },
} as const;

export default witness;
