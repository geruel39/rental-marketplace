"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CircleDollarSign,
  FileSearch,
  Flag,
  LayoutDashboard,
  ListChecks,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const adminSections = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/analytics", label: "Analytics", icon: FileSearch },
    ],
  },
  {
    title: "Manage",
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/listings", label: "Listings", icon: Package },
      { href: "/admin/bookings", label: "Bookings", icon: ReceiptText },
      { href: "/admin/reviews", label: "Reviews", icon: Flag },
      { href: "/admin/inventory", label: "Inventory", icon: Boxes },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/payouts", label: "Payouts", icon: CircleDollarSign },
      { href: "/admin/reports", label: "Reports", icon: ShieldAlert },
      { href: "/admin/categories", label: "Categories", icon: ListChecks },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
    ],
  },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 border-r border-orange-200/70 bg-gradient-to-b from-orange-50 via-background to-background lg:fixed lg:top-16 lg:bottom-0 lg:left-0 lg:block">
      <div className="flex h-full flex-col overflow-y-auto p-4 pb-6">
        <div className="mb-6 rounded-2xl border border-orange-200/80 bg-white/90 p-4 shadow-sm">
          <Badge className="bg-orange-600 text-white hover:bg-orange-600">
            ADMIN
          </Badge>
          <p className="mt-3 text-sm font-semibold text-foreground">Super Admin Panel</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Moderate the marketplace, review reports, and manage platform operations.
          </p>
        </div>

        <nav className="space-y-6">
          {adminSections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h2 className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700/80">
                {section.title}
              </h2>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/admin"
                      ? pathname === item.href
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        isActive
                          ? "bg-orange-600 text-white shadow-sm"
                          : "text-muted-foreground hover:bg-orange-100/80 hover:text-foreground",
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

        <div className="mt-auto pt-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl border border-orange-200/80 bg-white/90 px-3 py-2.5 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-50"
          >
            <ArrowLeft className="size-4" />
            Back to Marketplace
          </Link>
        </div>
      </div>
    </aside>
  );
}
