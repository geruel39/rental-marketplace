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
    <aside className="bg-brand-dark text-brand-light hidden w-72 shrink-0 border-r border-white/10 lg:fixed lg:top-16 lg:bottom-0 lg:left-0 lg:block">
      <div className="flex h-full flex-col overflow-y-auto p-4 pb-6">
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
          <Badge className="bg-brand-sky text-brand-dark hover:bg-brand-sky">
            ADMIN
          </Badge>
          <p className="mt-3 text-sm font-semibold text-white">Super Admin Panel</p>
          <p className="mt-1 text-sm text-brand-light/70">
            Moderate the marketplace, review reports, and manage platform operations.
          </p>
        </div>

        <nav className="space-y-6">
          {adminSections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h2 className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-light/50">
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
                          ? "bg-brand-navy text-white shadow-sm"
                          : "text-brand-light/70 hover:bg-white/10 hover:text-white",
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
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-brand-light transition-colors hover:bg-white/10"
          >
            <ArrowLeft className="size-4" />
            Back to Marketplace
          </Link>
        </div>
      </div>
    </aside>
  );
}
