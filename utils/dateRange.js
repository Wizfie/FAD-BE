import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

export function getRange(dateStr, period) {
  const base = dateStr ? new Date(dateStr) : new Date();
  if (period === "day") return { start: startOfDay(base), end: endOfDay(base) };
  if (period === "week")
    return {
      start: startOfWeek(base, { weekStartsOn: 1 }),
      end: endOfWeek(base, { weekStartsOn: 1 }),
    };
  return { start: startOfMonth(base), end: endOfMonth(base) };
}
