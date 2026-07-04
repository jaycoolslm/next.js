import { describe, expect, it } from "vitest";
import { routeDeal, tripwireFor, type RoutingInput } from "@/lib/routing";

function input(overrides: Partial<RoutingInput> = {}): RoutingInput {
  return {
    dealType: "murabaha",
    borrowerEntityType: "individual",
    purpose: "personal",
    amountPence: 500_000,
    financierPriorDealCount: 0,
    ...overrides,
  };
}

describe("routeDeal", () => {
  it("routes ltd company borrowers as unregulated regardless of history", () => {
    for (const count of [0, 1, 5]) {
      const result = routeDeal(
        input({ borrowerEntityType: "ltd_company", financierPriorDealCount: count }),
      );
      expect(result.regulatoryStatus).toBe("unregulated");
      expect(result.noteKey).toBe("ltd_company_unregulated");
    }
  });

  it("routes a first-time financier lending to an individual as regulated non-commercial", () => {
    const result = routeDeal(input({ borrowerEntityType: "individual" }));
    expect(result.regulatoryStatus).toBe("regulated_non_commercial");
    expect(result.noteKey).toBe("first_time_regulated_non_commercial");
    expect(result.tripwire).toBeNull();
  });

  it("routes a first-time financier lending to a sole trader as regulated non-commercial", () => {
    const result = routeDeal(input({ borrowerEntityType: "sole_trader" }));
    expect(result.regulatoryStatus).toBe("regulated_non_commercial");
  });

  it("routes repeat financing to individuals as needs_review with a tripwire", () => {
    const result = routeDeal(
      input({ borrowerEntityType: "individual", financierPriorDealCount: 1 }),
    );
    expect(result.regulatoryStatus).toBe("needs_review");
    expect(result.noteKey).toBe("repeat_needs_review");
    expect(result.tripwire).toBe("amber");
  });

  it("routes partnerships as needs_review", () => {
    const result = routeDeal(input({ borrowerEntityType: "partnership" }));
    expect(result.regulatoryStatus).toBe("needs_review");
    expect(result.noteKey).toBe("partnership_needs_review");
  });

  it("purpose and amount do not change the routing outcome in v1", () => {
    const personal = routeDeal(input({ purpose: "personal" }));
    const business = routeDeal(input({ purpose: "business", amountPence: 1 }));
    expect(personal.regulatoryStatus).toBe(business.regulatoryStatus);
  });
});

describe("tripwireFor", () => {
  it("does not fire on a financier's first murabaha", () => {
    expect(tripwireFor("murabaha", 0)).toBeNull();
  });

  it("fires amber on the 2nd murabaha as financier", () => {
    expect(tripwireFor("murabaha", 1)).toBe("amber");
  });

  it("fires red on the 3rd and every later murabaha", () => {
    expect(tripwireFor("murabaha", 2)).toBe("red");
    expect(tripwireFor("murabaha", 10)).toBe("red");
  });

  it("qard hasan counts separately with a softer notice at the 3rd loan", () => {
    expect(tripwireFor("qard_hasan", 0)).toBeNull();
    expect(tripwireFor("qard_hasan", 1)).toBeNull();
    expect(tripwireFor("qard_hasan", 2)).toBe("qard_info");
    expect(tripwireFor("qard_hasan", 5)).toBe("qard_info");
  });
});
