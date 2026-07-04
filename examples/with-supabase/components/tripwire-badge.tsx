import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TripwireLevel } from "@/lib/types";

const LABELS: Record<TripwireLevel, string> = {
  amber: "Amber",
  red: "Red",
  qard_info: "Qard info",
};

export function TripwireBadge({
  level,
  className,
}: {
  level: TripwireLevel;
  className?: string;
}) {
  if (level === "red") {
    return (
      <Badge variant="destructive" className={className}>
        {LABELS.red}
      </Badge>
    );
  }
  if (level === "amber") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-amber-500/60 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
          className,
        )}
      >
        {LABELS.amber}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={className}>
      {LABELS.qard_info}
    </Badge>
  );
}
