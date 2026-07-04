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
