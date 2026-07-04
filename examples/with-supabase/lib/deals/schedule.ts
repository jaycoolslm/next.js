import type { ScheduleFrequency } from "../types";

export interface ScheduleRow {
  instalment: number;
  dueDate: string; // ISO date
  amountPence: number;
}

/**
 * Expands the stored schedule terms into concrete instalment rows. Dates are
 * calendar arithmetic on the ISO date only (no timezone involvement): monthly
 * steps keep the day-of-month, clamped to the end of shorter months.
 */
export function buildSchedule(
  instalmentCount: number,
  instalmentAmountPence: number,
  firstDueDate: string,
  frequency: ScheduleFrequency,
): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  const [y, m, d] = firstDueDate.split("-").map(Number);
  const count = frequency === "lump_sum" ? 1 : instalmentCount;
  for (let i = 0; i < count; i++) {
    let date: Date;
    if (frequency === "weekly") {
      date = new Date(Date.UTC(y, m - 1, d + i * 7));
    } else if (frequency === "monthly") {
      // Clamp to end of month: e.g. 31 Jan + 1 month → 28/29 Feb.
      const target = new Date(Date.UTC(y, m - 1 + i, 1));
      const daysInMonth = new Date(
        Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
      ).getUTCDate();
      target.setUTCDate(Math.min(d, daysInMonth));
      date = target;
    } else {
      date = new Date(Date.UTC(y, m - 1, d));
    }
    rows.push({
      instalment: i + 1,
      dueDate: date.toISOString().slice(0, 10),
      amountPence: instalmentAmountPence,
    });
  }
  return rows;
}
