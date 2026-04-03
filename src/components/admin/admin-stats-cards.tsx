import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Calendar,
  DollarSign,
  Flag,
  MessageSquare,
  Package,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { AdminDashboardStats } from "@/types";

type StatCardConfig = {
  title: string;
  value: string;
  subtitle?: string;
  href?: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "red" | "orange";
};

const toneClasses: Record<StatCardConfig["tone"], string> = {
  blue: "border-blue-200/70 bg-blue-50 text-blue-700",
  green: "border-emerald-200/70 bg-emerald-50 text-emerald-700",
  red: "border-red-200/70 bg-red-50 text-red-700",
  orange: "border-border/70 bg-brand-light text-brand-navy",
};

function StatCard({ title, value, subtitle, href, icon: Icon, tone }: StatCardConfig) {
  const content = (
    <Card className="gap-0 overflow-hidden border-border/70 bg-white py-0 shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </p>
          <div className="space-y-1">
            <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-2xl border ${toneClasses[tone]}`}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link className="transition-transform hover:-translate-y-0.5" href={href}>
      {content}
    </Link>
  );
}

export function AdminStatsCards({ stats }: { stats: AdminDashboardStats }) {
  const cards: StatCardConfig[] = [
    {
      title: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      tone: "blue",
    },
    {
      title: "New This Month",
      value: stats.newUsersThisMonth.toLocaleString(),
      icon: UserPlus,
      tone: "green",
    },
    {
      title: "Active Listings",
      value: stats.activeListings.toLocaleString(),
      icon: Package,
      tone: "blue",
    },
    {
      title: "Flagged Listings",
      value: stats.flaggedListings.toLocaleString(),
      href: "/admin/listings?flagged=true",
      icon: Flag,
      tone: "red",
    },
    {
      title: "Active Bookings",
      value: stats.activeBookings.toLocaleString(),
      icon: Calendar,
      tone: "blue",
    },
    {
      title: "Disputed",
      value: stats.disputedBookings.toLocaleString(),
      href: "/admin/bookings?disputed=true",
      icon: AlertTriangle,
      tone: "red",
    },
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      tone: "green",
    },
    {
      title: "Revenue This Month",
      value: formatCurrency(stats.revenueThisMonth),
      icon: TrendingUp,
      tone: "green",
    },
    {
      title: "Pending Payouts",
      value: stats.pendingPayouts.toLocaleString(),
      subtitle: formatCurrency(stats.pendingPayoutsAmount),
      icon: Wallet,
      tone: "orange",
    },
    {
      title: "Open Reports",
      value: stats.openReports.toLocaleString(),
      href: "/admin/reports",
      icon: MessageSquare,
      tone: "red",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  );
}


