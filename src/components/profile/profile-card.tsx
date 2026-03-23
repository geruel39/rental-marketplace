import Link from "next/link";
import { CheckCircle2, Clock3, Mail, MessageSquare, Phone, ShieldCheck, Star } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, getInitials } from "@/lib/utils";
import type { Profile } from "@/types";

interface ProfileCardProps {
  profile: Profile;
  compact?: boolean;
}

function VerificationBadge({
  label,
  verified,
  icon,
}: {
  label: string;
  verified: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Badge
      className={verified ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}
      variant={verified ? "outline" : "secondary"}
    >
      {icon}
      {label}
    </Badge>
  );
}

export function ProfileCard({ profile, compact = false }: ProfileCardProps) {
  const displayName = profile.display_name || profile.full_name || profile.email;

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <Avatar size={compact ? "lg" : "default"} className={compact ? "size-14" : "size-16"}>
          <AvatarImage alt={displayName} src={profile.avatar_url ?? undefined} />
          <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="text-lg font-semibold">{displayName}</h3>
            <p className="text-sm text-muted-foreground">
              Member since {formatDate(profile.member_since)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="size-4 fill-current text-amber-500" />
              {profile.total_reviews_as_lister > 0
                ? profile.rating_as_lister.toFixed(1)
                : "New"}
            </span>
            <span>
              ({profile.total_reviews_as_lister} lister review
              {profile.total_reviews_as_lister === 1 ? "" : "s"})
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <VerificationBadge
          icon={profile.email_verified ? <CheckCircle2 className="size-3.5" /> : <Mail className="size-3.5" />}
          label="Email"
          verified={profile.email_verified}
        />
        <VerificationBadge
          icon={profile.phone_verified ? <CheckCircle2 className="size-3.5" /> : <Phone className="size-3.5" />}
          label="Phone"
          verified={profile.phone_verified}
        />
        <VerificationBadge
          icon={profile.id_verified ? <CheckCircle2 className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
          label="ID"
          verified={profile.id_verified}
        />
      </div>

      <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="rounded-2xl bg-muted/40 p-3">
          <p className="font-medium text-foreground">Response rate</p>
          <p>{profile.response_rate}%</p>
        </div>
        <div className="rounded-2xl bg-muted/40 p-3">
          <p className="flex items-center gap-1 font-medium text-foreground">
            <Clock3 className="size-4" />
            Response time
          </p>
          <p>{profile.response_time_hours} hour(s)</p>
        </div>
      </div>

      {!compact ? (
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          {profile.bio ? <p>{profile.bio}</p> : null}
          {profile.location ? <p>{profile.location}</p> : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`/users/${profile.id}`}>View Profile</Link>
        </Button>
        <Button type="button" variant="secondary">
          <MessageSquare className="size-4" />
          Message
        </Button>
      </div>
    </div>
  );
}
