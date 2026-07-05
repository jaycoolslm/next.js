import { cn } from "@/lib/utils";
import { lifecycleFor } from "@/lib/deals/state-machine";
import { statusLabel, StatusBadge } from "./status-badge";
import type { DealStatus, DealType } from "@/lib/types";

const DISTINCT_STATUSES: DealStatus[] = [
  "defaulted",
  "cancelled",
  "disputed",
  "in_arbitration",
];

// Short labels for the horizontal rail — the full status labels are too long
// to sit under a pill on a narrow (~375px) phone viewport.
const RAIL_LABELS: Partial<Record<DealStatus, string>> = {
  draft: "Draft",
  promise_recorded: "Promise",
  financier_purchased: "Purchased",
  ownership_window: "Ownership",
  sale_offered: "Sale offered",
  sale_accepted: "Accepted",
  offered: "Offered",
  accepted: "Accepted",
  witnessing: "Witnessing",
  active: "Active",
  settled: "Settled",
};

/**
 * Horizontal pill-and-connector lifecycle rail (Promise → … → Settled).
 * Completed steps are filled (emerald), the current step highlighted (amber),
 * future steps muted. Scrolls horizontally inside its own container so it stays
 * readable on a phone without letting the page overflow sideways.
 */
export function LifecycleRail({
  type,
  status,
}: {
  type: DealType;
  status: DealStatus;
}) {
  const steps = lifecycleFor(type);
  // For "distinct" off-path statuses (cancelled/disputed/etc.) nothing on the
  // happy path is current; show progress up to where it left the path.
  const currentIndex = steps.indexOf(status);

  return (
    <div
      className="-mx-1 overflow-x-auto px-1 pb-1"
      role="list"
      aria-label="Deal lifecycle"
    >
      <ol className="flex min-w-max items-start gap-0">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDone = currentIndex >= 0 && index < currentIndex;
          const reached = isDone || isCurrent;
          return (
            <li
              key={step}
              role="listitem"
              aria-current={isCurrent ? "step" : undefined}
              className="relative flex w-[76px] shrink-0 flex-col items-center text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[-38px] top-[7px] h-0.5 w-[76px]",
                    reached ? "bg-emerald-600" : "bg-border",
                  )}
                />
              )}
              <span
                aria-hidden
                className={cn(
                  "relative z-10 mb-2 h-3.5 w-3.5 rounded-full border-2",
                  isCurrent &&
                    "border-amber-500 bg-amber-500 ring-4 ring-amber-500/20",
                  isDone && "border-emerald-600 bg-emerald-600",
                  !reached && "border-border bg-background",
                )}
              />
              <span
                className={cn(
                  "relative z-10 text-[10.5px] leading-tight",
                  isCurrent
                    ? "font-semibold text-amber-600 dark:text-amber-500"
                    : reached
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {RAIL_LABELS[step] ?? statusLabel(step)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function Timeline({
  type,
  status,
}: {
  type: DealType;
  status: DealStatus;
}) {
  const steps = lifecycleFor(type);
  const currentIndex = steps.indexOf(status);
  const distinct = DISTINCT_STATUSES.includes(status);

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDone = currentIndex >= 0 && index < currentIndex;
          return (
            <li
              key={step}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium",
                isCurrent &&
                  "border-primary bg-primary text-primary-foreground",
                isDone && "border-transparent bg-muted text-muted-foreground",
                !isCurrent && !isDone && "border-dashed text-muted-foreground",
              )}
            >
              {statusLabel(step)}
            </li>
          );
        })}
      </ol>
      {distinct && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">This deal is now:</span>
          <StatusBadge status={status} />
        </div>
      )}
    </div>
  );
}
