import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Bell,
  CalendarPlus,
  CheckCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  MessageSquare,
  Play,
  RefreshCcw,
  RefreshCw,
  RotateCcw,
  Shield,
  Star,
  XCircle,
} from "lucide-react";

import {
  NOTIFICATION_CONFIG,
  type BundlePreviewItem,
  type Notification,
  type NotificationType,
} from "@/types";

const ICON_MAP = {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CalendarPlus,
  CheckCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  MessageSquare,
  Play,
  RefreshCcw,
  RefreshCw,
  RotateCcw,
  Shield,
  Star,
  XCircle,
} satisfies Record<string, LucideIcon>;

export function getNotificationMeta(type: string): {
  icon: LucideIcon;
  iconClassName: string;
  iconContainerClassName: string;
} {
  const config = type in NOTIFICATION_CONFIG
    ? NOTIFICATION_CONFIG[type as NotificationType]
    : null;
  const Icon = (config?.icon ? ICON_MAP[config.icon] : null) ?? Bell;

  return {
    icon: Icon,
    iconClassName: config?.color ?? "text-brand-steel",
    iconContainerClassName: "bg-brand-light",
  };
}

export function getNotificationPriority(type: string) {
  if (!(type in NOTIFICATION_CONFIG)) {
    return "low" as const;
  }

  return NOTIFICATION_CONFIG[type as NotificationType].priority;
}

export function getNotificationTarget(notification: Notification) {
  if (!(notification.type in NOTIFICATION_CONFIG)) {
    return notification.action_url ?? "/dashboard/notifications";
  }

  const config = NOTIFICATION_CONFIG[notification.type];

  if (notification.is_bundled) {
    return config.defaultActionUrl;
  }

  return notification.action_url ?? config.defaultActionUrl;
}

export function getNotificationTimestamp(notification: Notification) {
  return notification.last_bundled_at ?? notification.created_at;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function formatBundlePreviewItem(
  item: BundlePreviewItem,
  options?: {
    maxTextLength?: number;
    quoted?: boolean;
  },
) {
  const maxTextLength = options?.maxTextLength ?? 60;
  const text = truncateText(item.text, maxTextLength);
  const content = options?.quoted ? `"${text}"` : text;

  return item.from_name ? `${item.from_name}: ${content}` : content;
}
