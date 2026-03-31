import {
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Play,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatRelativeTime, getInitials } from "@/lib/utils";
import { BOOKING_STATUS_CONFIG } from "@/types";
import type { BookingTimelineWithActor } from "@/types";

interface BookingTimelineProps {
  currentUserId: string;
  timeline: BookingTimelineWithActor[];
}

const iconMap = {
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Play,
  RotateCcw,
  Truck,
  XCircle,
} as const;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMetadataValue(key: string, value: unknown) {
  if (typeof value === "number") {
    if (/(amount|price|payout|total|fee|deposit)/i.test(key)) {
      return formatCurrency(value);
    }

    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string" && value.length > 0) {
    return value.replaceAll("_", " ");
  }

  return null;
}

function getActorTone(role: BookingTimelineWithActor["actor_role"]) {
  switch (role) {
    case "lister":
      return {
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
        dotClass: "bg-emerald-500",
      };
    case "renter":
      return {
        badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
        dotClass: "bg-blue-500",
      };
    case "admin":
      return {
        badgeClass: "border-orange-200 bg-orange-50 text-orange-700",
        dotClass: "bg-orange-500",
      };
    case "system":
    default:
      return {
        badgeClass: "border-slate-200 bg-slate-100 text-slate-700",
        dotClass: "bg-slate-400",
      };
  }
}

export function BookingTimeline({
  currentUserId,
  timeline,
}: BookingTimelineProps) {
  return (
    <div className="space-y-0">
      {timeline.map((entry, index) => {
        const isLatest = index === timeline.length - 1;
        const config = BOOKING_STATUS_CONFIG[entry.status];
        const StatusIcon = iconMap[config.icon as keyof typeof iconMap] ?? Clock;
        const tone = getActorTone(entry.actor_role);
        const actorName =
          entry.actor_role === "system"
            ? "System"
            : entry.actor?.display_name || entry.actor?.full_name || "Unknown user";
        const metadataEntries = Object.entries(entry.metadata ?? {}).filter(([, value]) =>
          ["string", "number", "boolean"].includes(typeof value),
        );

        return (
          <div key={entry.id} className="relative flex gap-4 pb-8 last:pb-0">
            <div className="relative flex w-8 shrink-0 justify-center">
              {index < timeline.length - 1 ? (
                <span className="absolute top-7 bottom-0 left-1/2 w-px -translate-x-1/2 bg-border" />
              ) : null}
              <span
                className={cn(
                  "relative z-10 mt-1 flex size-4 items-center justify-center rounded-full border-4 border-background",
                  tone.dotClass,
                  isLatest && "animate-pulse",
                )}
              />
            </div>

            <div
              className={cn(
                "min-w-0 flex-1 rounded-2xl border border-border/70 bg-background p-4 shadow-sm",
                isLatest && "ring-1 ring-primary/20",
              )}
            >
              <div className="flex flex-wrap items-start gap-2">
                <Badge className={cn("gap-1 border-0", config.color)} variant="secondary">
                  <StatusIcon className="size-3.5" />
                  {config.label}
                </Badge>
                {entry.actor_role === "admin" ? (
                  <Badge className={tone.badgeClass} variant="outline">
                    Admin
                  </Badge>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                <p className="font-semibold">{entry.title}</p>
                {entry.description ? (
                  <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {entry.description}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {entry.actor_role === "system" ? (
                  <span className="inline-flex items-center gap-2">
                    <span>⚙️</span>
                    <span>System</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarImage
                        alt={actorName}
                        src={entry.actor?.avatar_url ?? undefined}
                      />
                      <AvatarFallback>{getInitials(actorName)}</AvatarFallback>
                    </Avatar>
                    <span>
                      {actorName}
                      {entry.actor_id === currentUserId ? " (You)" : ""}
                    </span>
                  </span>
                )}

                <span>
                  {formatTimestamp(entry.created_at)} ({formatRelativeTime(entry.created_at)})
                </span>
              </div>

              {metadataEntries.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {metadataEntries.map(([key, value]) => {
                    const formatted = formatMetadataValue(key, value);

                    if (!formatted) {
                      return null;
                    }

                    return (
                      <Badge key={key} variant="outline">
                        {key.replaceAll("_", " ")}: {formatted}
                      </Badge>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
