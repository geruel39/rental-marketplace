"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  Shield,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";

import { getBookingDetails } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const dashboardSections = [
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

export function DashboardSidebar({
  currentUserId,
  isAdmin = false,
}: {
  currentUserId: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [bookingRouteTarget, setBookingRouteTarget] = useState<string | null>(null);

  useEffect(() => {
    async function resolveBookingRoute() {
      if (!pathname.startsWith("/dashboard/bookings/")) {
        setBookingRouteTarget(null);
        return;
      }

      const bookingId = pathname.split("/")[3];

      if (!bookingId) {
        setBookingRouteTarget(null);
        return;
      }

      const booking = await getBookingDetails(bookingId);

      if (!booking) {
        setBookingRouteTarget(null);
        return;
      }

      if (booking.lister_id === currentUserId) {
        setBookingRouteTarget("/dashboard/requests");
        return;
      }

      if (booking.renter_id === currentUserId) {
        setBookingRouteTarget("/dashboard/my-rentals");
        return;
      }

      setBookingRouteTarget("/dashboard");
    }

    void resolveBookingRoute();
  }, [currentUserId, pathname]);

  const effectivePath = bookingRouteTarget ?? pathname;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-white lg:fixed lg:top-16 lg:bottom-0 lg:left-0 lg:block">
      <div className="flex h-full flex-col overflow-y-auto p-4 pb-6">
        <Button asChild className="mb-6 w-full justify-start bg-brand-navy text-white hover:bg-brand-steel">
          <Link href="/listings/new">
            <Plus className="size-4" />
            Create Listing
          </Link>
        </Button>

        <nav className="space-y-6">
          {dashboardSections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h2 className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy/70">
                {section.title}
              </h2>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    effectivePath === item.href ||
                    effectivePath.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 border-l-2 border-transparent rounded-r-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "border-brand-navy bg-brand-navy/10 text-brand-navy"
                          : "text-foreground hover:bg-brand-light hover:text-brand-steel",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 text-brand-steel",
                          isActive && "text-brand-navy",
                        )}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {isAdmin ? (
            <div className="space-y-2">
              <Separator className="bg-border" />
              <h2 className="px-3 pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy/70">
                Admin
              </h2>
              <div className="space-y-1">
                <Link
                  href="/admin"
                  className={cn(
                    "flex items-center gap-3 border-l-2 border-transparent rounded-r-lg px-3 py-2 text-sm transition-colors",
                    pathname === "/admin" || pathname.startsWith("/admin/")
                      ? "border-brand-navy bg-brand-navy/10 text-brand-navy"
                      : "text-foreground hover:bg-brand-light hover:text-brand-steel",
                  )}
                >
                  <Shield
                    className={cn(
                      "size-4 text-brand-steel",
                      (pathname === "/admin" || pathname.startsWith("/admin/")) && "text-brand-navy",
                    )}
                  />
                  Admin Panel
                </Link>
              </div>
            </div>
          ) : null}
        </nav>
      </div>
    </aside>
  );
}
