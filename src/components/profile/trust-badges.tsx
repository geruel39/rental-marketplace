import { CalendarDays, CheckCircle2, IdCard, Mail, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/types";

interface TrustBadgesProps {
  profile: Profile;
}

function TrustBadge({
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
      {verified ? <CheckCircle2 className="size-3.5" /> : icon}
      {label}
    </Badge>
  );
}

export function TrustBadges({ profile }: TrustBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TrustBadge
        icon={<Mail className="size-3.5" />}
        label="Email verified"
        verified={profile.email_verified}
      />
      <TrustBadge
        icon={<Phone className="size-3.5" />}
        label="Phone verified"
        verified={profile.phone_verified}
      />
      <TrustBadge
        icon={<IdCard className="size-3.5" />}
        label="ID verified"
        verified={profile.id_verified}
      />
      <Badge variant="secondary">
        <CalendarDays className="size-3.5" />
        Member since {formatDate(profile.member_since)}
      </Badge>
    </div>
  );
}
