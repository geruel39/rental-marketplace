"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CreditCard,
  Heart,
  LayoutDashboard,
  MessageSquare,
  Package,
  Plus,
  Receipt,
  Settings,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sections = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    title: "As Lister",
    items: [
      { href: "/dashboard/my-listings", label: "My Listings", icon: Package },
      { href: "/dashboard/inventory", label: "Inventory", icon: ShieldCheck },
      { href: "/dashboard/requests", label: "Booking Requests", icon: Receipt },
      { href: "/dashboard/earnings", label: "Earnings", icon: Wallet },
    ],
  },
  {
    title: "As Renter",
    items: [
      { href: "/dashboard/my-rentals", label: "My Rentals", icon: CreditCard },
      { href: "/dashboard/favorites", label: "Favorites", icon: Heart },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
      {
        href: "/dashboard/settings/payments",
        label: "Payments",
        icon: Wallet,
      },
      { href: "/dashboard/reviews", label: "Reviews", icon: Star },
    ],
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-background md:fixed md:inset-y-16 md:left-0 md:block">
      <div className="flex h-full flex-col overflow-y-auto p-4">
        <Button asChild className="mb-6 w-full justify-start">
          <Link href="/listings/new">
            <Plus className="size-4" />
            Create Listing
          </Link>
        </Button>

        <nav className="space-y-6">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h2 className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {section.title}
              </h2>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
