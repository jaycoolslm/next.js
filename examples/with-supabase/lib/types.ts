// Core domain types for 282. These mirror the Postgres schema in
// supabase/migrations — the database is the source of truth; keep in sync.

export type DealType = "murabaha" | "qard_hasan";

export type DealStatus =
  // murabaha pre-active sequence (order is shariah-critical)
  | "draft"
  | "promise_recorded"
  | "financier_purchased"
  | "ownership_window"
  | "sale_offered"
  | "sale_accepted"
  // qard hasan pre-active sequence
  | "offered"
  | "accepted"
  // shared
  | "witnessing"
  | "active"
  | "settled"
  | "defaulted"
  | "disputed"
  | "in_arbitration"
  | "cancelled";

export type OrgRole = "admin" | "member";

export type BorrowerEntityType =
  | "ltd_company"
  | "sole_trader"
  | "individual"
  | "partnership";

export type DealPurpose = "business" | "personal";

export type RegulatoryStatus =
  | "unregulated"
  | "regulated_non_commercial"
  | "needs_review";

export type ScheduleFrequency = "monthly" | "weekly" | "lump_sum";

export type WitnessStatus = "invited" | "attested";

export type TripwireLevel = "amber" | "red" | "qard_info";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface OrgMember {
  user_id: string;
  org_id: string;
  role: OrgRole;
}

export interface Profile {
  user_id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
}

export interface Deal {
  id: string;
  org_id: string;
  type: DealType;
  status: DealStatus;
  financier_id: string;
  customer_id: string;
  created_by: string;
  currency: "GBP";
  // murabaha asset fields
  asset_description: string | null;
  supplier_name: string | null;
  cost_price_pence: number | null;
  markup_pence: number | null;
  total_price_pence: number | null; // generated: cost + markup
  // qard hasan
  principal_pence: number | null;
  // schedule
  instalment_count: number | null;
  instalment_amount_pence: number | null;
  first_due_date: string | null;
  frequency: ScheduleFrequency | null;
  // regulatory routing
  borrower_entity_type: BorrowerEntityType;
  purpose: DealPurpose;
  regulatory_status: RegulatoryStatus;
  routing_notes: string;
  // arbitration rail
  arbitrator_name: string | null;
  arbitrator_contact: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealWitness {
  deal_id: string;
  user_id: string;
  status: WitnessStatus;
}

export interface DealEvent {
  id: string;
  deal_id: string;
  seq: number;
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  prev_hash: string;
  hash: string;
}

export interface DealDocument {
  id: string;
  deal_id: string;
  kind: "purchase_receipt" | "contract_snapshot";
  storage_path: string;
  sha256: string;
  created_at: string;
}

export interface Repayment {
  id: string;
  deal_id: string;
  amount_pence: number;
  paid_on: string;
  recorded_by: string;
  note: string | null;
  counterparty_confirmed: boolean;
}

export interface Attestation {
  id: string;
  deal_id: string;
  witness_user_id: string;
  typed_full_name: string;
  otp_verified_at: string;
  contract_snapshot_sha256: string;
  user_agent: string | null;
  created_at: string;
}

export interface TripwireAlert {
  id: string;
  user_id: string;
  org_id: string;
  level: TripwireLevel;
  message: string;
  acknowledged_at: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role: OrgRole;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}
