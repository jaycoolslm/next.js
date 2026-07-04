import { Badge } from "@/components/ui/badge";
import { dealLifecycle } from "@/content";
import type { DealStatus } from "@/lib/types";

const lifecycle = dealLifecycle["en-GB"];

const LABELS: Record<DealStatus, string> = {
  draft: "Draft",
  promise_recorded: "Promise recorded",
  financier_purchased: "Financier purchased",
  ownership_window: "Ownership window",
  sale_offered: "Sale offered",
  sale_accepted: "Sale accepted",
  offered: "Offered",
  accepted: "Accepted",
  witnessing: "Witnessing",
  active: "Active",
  settled: lifecycle.statuses.settled.label,
  defaulted: lifecycle.statuses.defaulted.label,
  disputed: "Disputed",
  in_arbitration: "In arbitration",
  cancelled: lifecycle.statuses.cancelled.label,
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const VARIANTS: Record<DealStatus, BadgeVariant> = {
  draft: "outline",
  promise_recorded: "outline",
  financier_purchased: "outline",
  ownership_window: "secondary",
  sale_offered: "outline",
  sale_accepted: "outline",
  offered: "outline",
  accepted: "outline",
  witnessing: "secondary",
  active: "default",
  settled: "default",
  defaulted: "destructive",
  disputed: "destructive",
  in_arbitration: "secondary",
  cancelled: "destructive",
};

// One-line descriptions surfaced via the `title` attribute. Terminal statuses
// reuse the verbatim content descriptions.
const TITLES: Record<DealStatus, string> = {
  draft: "Being prepared. Nothing has been agreed yet.",
  promise_recorded: lifecycle.promise.body,
  financier_purchased: lifecycle.ownershipWindow.body,
  ownership_window: lifecycle.ownershipWindow.body,
  sale_offered: lifecycle.saleOffer.body,
  sale_accepted: "The customer has accepted the separate sale offer.",
  offered: "The lender has offered the terms of the benevolent loan.",
  accepted: "The borrower has accepted the terms of the benevolent loan.",
  witnessing: lifecycle.witnessing.body,
  active: "The agreement is witnessed and in effect; repayments are recorded here.",
  settled: lifecycle.statuses.settled.description,
  defaulted: lifecycle.statuses.defaulted.description,
  disputed: lifecycle.dispute.body,
  in_arbitration: lifecycle.arbitration.body,
  cancelled: lifecycle.statuses.cancelled.description,
};

export function StatusBadge({
  status,
  className,
}: {
  status: DealStatus;
  className?: string;
}) {
  return (
    <Badge variant={VARIANTS[status]} className={className} title={TITLES[status]}>
      {LABELS[status]}
    </Badge>
  );
}

export function statusLabel(status: DealStatus): string {
  return LABELS[status];
}
