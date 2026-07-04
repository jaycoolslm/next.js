import { describe, expect, it } from "vitest";
import {
  availableActions,
  isActionAllowed,
  lifecycleFor,
} from "@/lib/deals/state-machine";

describe("murabaha state machine (TS mirror)", () => {
  it("enforces the shariah-critical two-contract order", () => {
    expect(isActionAllowed("murabaha", "draft", "record_promise", "customer")).toBe(true);
    // The sale cannot be offered before the financier owns the asset.
    expect(isActionAllowed("murabaha", "draft", "offer_sale")).toBe(false);
    expect(isActionAllowed("murabaha", "promise_recorded", "offer_sale")).toBe(false);
    expect(isActionAllowed("murabaha", "ownership_window", "offer_sale", "financier")).toBe(true);
    // Acceptance only after a sale offer exists.
    expect(isActionAllowed("murabaha", "ownership_window", "accept_sale")).toBe(false);
    expect(isActionAllowed("murabaha", "sale_offered", "accept_sale", "customer")).toBe(true);
  });

  it("restricts actions to the right party", () => {
    expect(isActionAllowed("murabaha", "draft", "record_promise", "financier")).toBe(false);
    expect(isActionAllowed("murabaha", "promise_recorded", "record_purchase", "customer")).toBe(false);
    expect(isActionAllowed("murabaha", "sale_offered", "accept_sale", "financier")).toBe(false);
  });

  it("allows cancel from any pre-active status but not after activation", () => {
    for (const status of ["draft", "promise_recorded", "ownership_window", "sale_offered", "sale_accepted", "witnessing"] as const) {
      expect(isActionAllowed("murabaha", status, "cancel")).toBe(true);
    }
    expect(isActionAllowed("murabaha", "active", "cancel")).toBe(false);
    expect(isActionAllowed("murabaha", "settled", "cancel")).toBe(false);
  });

  it("only the financier can settle, default, or grant ibra", () => {
    expect(isActionAllowed("murabaha", "active", "settle", "financier")).toBe(true);
    expect(isActionAllowed("murabaha", "active", "settle", "customer")).toBe(false);
    expect(isActionAllowed("murabaha", "active", "grant_ibra", "financier")).toBe(true);
    expect(isActionAllowed("murabaha", "active", "grant_ibra", "customer")).toBe(false);
  });

  it("routes disputes through arbitration", () => {
    expect(availableActions("murabaha", "disputed")).toEqual(["move_to_arbitration"]);
    expect(isActionAllowed("murabaha", "in_arbitration", "settle", "financier")).toBe(true);
    expect(isActionAllowed("murabaha", "in_arbitration", "mark_defaulted", "financier")).toBe(true);
  });

  it("offers no actions in terminal states", () => {
    for (const status of ["settled", "defaulted", "cancelled"] as const) {
      expect(availableActions("murabaha", status)).toEqual([]);
    }
  });
});

describe("qard hasan state machine (TS mirror)", () => {
  it("uses the simple offer/accept sequence", () => {
    expect(isActionAllowed("qard_hasan", "draft", "offer_terms", "financier")).toBe(true);
    expect(isActionAllowed("qard_hasan", "draft", "record_promise")).toBe(false);
    expect(isActionAllowed("qard_hasan", "offered", "accept_terms", "customer")).toBe(true);
    expect(isActionAllowed("qard_hasan", "accepted", "begin_witnessing")).toBe(true);
  });

  it("murabaha actions are unavailable on a qard hasan", () => {
    expect(isActionAllowed("qard_hasan", "draft", "offer_sale")).toBe(false);
    expect(isActionAllowed("qard_hasan", "offered", "record_purchase")).toBe(false);
  });
});

describe("lifecycleFor", () => {
  it("includes witnessing before active for both types", () => {
    for (const type of ["murabaha", "qard_hasan"] as const) {
      const lifecycle = lifecycleFor(type);
      expect(lifecycle.indexOf("witnessing")).toBeLessThan(lifecycle.indexOf("active"));
    }
  });
});
