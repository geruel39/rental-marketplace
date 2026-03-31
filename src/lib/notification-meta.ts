import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  MessageSquare,
  Package,
  RotateCcw,
  Star,
  Truck,
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
    case "booking_expired":
      return {
        icon: Clock,
        iconClassName: "text-rose-700",
        iconContainerClassName: "bg-rose-100",
      };
    case "item_shipped":
    case "booking_out_for_delivery":
      return {
        icon: Truck,
        iconClassName: "text-violet-700",
        iconContainerClassName: "bg-violet-100",
      };
    case "item_delivered":
    case "item_picked_up":
      return {
        icon: Package,
        iconClassName: "text-emerald-700",
        iconContainerClassName: "bg-emerald-100",
      };
    case "return_initiated":
      return {
        icon: RotateCcw,
        iconClassName: "text-sky-700",
        iconContainerClassName: "bg-sky-100",
      };
    case "item_returned":
      return {
        icon: RotateCcw,
        iconClassName: "text-emerald-700",
        iconContainerClassName: "bg-emerald-100",
      };
    case "condition_issue":
    case "return_condition_issue":
      return {
        icon: AlertTriangle,
        iconClassName: "text-amber-700",
        iconContainerClassName: "bg-amber-100",
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
