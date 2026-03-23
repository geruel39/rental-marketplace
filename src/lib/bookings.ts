import { differenceInCalendarDays, differenceInHours, startOfDay } from "date-fns";

import type { Booking } from "@/types";

export function calculateNumUnits(
  startDate: string | Date,
  endDate: string | Date,
  pricingPeriod: Booking["pricing_period"],
) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    return 0;
  }

  const calendarDayCount = differenceInCalendarDays(
    startOfDay(end),
    startOfDay(start),
  );

  switch (pricingPeriod) {
    case "hour":
      return Math.max(
        1,
        differenceInHours(end, start, {
          roundingMethod: "ceil",
        }),
      );
    case "week":
      return Math.max(1, Math.ceil(calendarDayCount / 7));
    case "month":
      return Math.max(1, Math.ceil(calendarDayCount / 30));
    case "day":
    default:
      return Math.max(1, calendarDayCount);
  }
}
