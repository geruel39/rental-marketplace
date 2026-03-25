import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  DollarSign,
  MessageSquare,
  Star,
  XCircle,
} from "lucide-react";

export function getNotificationMeta(type: string): {
  icon: LucideIcon;
  iconClassName: string;
  iconContainerClassName: string;
} {
  switch (type) {
    case "booking_request":
      return {
        icon: Calendar,
        iconClassName: "text-blue-600",
        iconContainerClassName: "bg-blue-100",
      };
    case "booking_confirmed":
    case "payment_confirmed":
    case "booking_completed":
      return {
        icon: CheckCircle,
        iconClassName: "text-emerald-600",
        iconContainerClassName: "bg-emerald-100",
      };
    case "payment_received":
      return {
        icon: DollarSign,
        iconClassName: "text-emerald-700",
        iconContainerClassName: "bg-emerald-100",
      };
    case "new_message":
      return {
        icon: MessageSquare,
        iconClassName: "text-sky-600",
        iconContainerClassName: "bg-sky-100",
      };
    case "review_received":
      return {
        icon: Star,
        iconClassName: "text-amber-600",
        iconContainerClassName: "bg-amber-100",
      };
    case "low_stock":
      return {
        icon: AlertTriangle,
        iconClassName: "text-amber-700",
        iconContainerClassName: "bg-amber-100",
      };
    case "out_of_stock":
    case "booking_declined":
    case "booking_cancelled":
      return {
        icon: XCircle,
        iconClassName: "text-rose-600",
        iconContainerClassName: "bg-rose-100",
      };
    default:
      return {
        icon: AlertTriangle,
        iconClassName: "text-muted-foreground",
        iconContainerClassName: "bg-muted",
      };
  }
}
