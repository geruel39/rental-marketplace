"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Boxes,
  Compass,
  Heart,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Star,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface RoleShellItem {
  href: string;
  label: string;
  icon: RoleShellIcon;
  badge?: number;
}

export type RoleShellIcon =
  | "badge-dollar-sign"
  | "boxes"
  | "compass"
  | "heart"
  | "layout-dashboard"
  | "package"
  | "receipt"
  | "settings"
  | "star";

const roleShellIcons: Record<RoleShellIcon, LucideIcon> = {
  "badge-dollar-sign": BadgeDollarSign,
  boxes: Boxes,
  compass: Compass,
  heart: Heart,
  "layout-dashboard": LayoutDashboard,
  package: Package,
  receipt: Receipt,
  settings: Settings,
  star: Star,
};

interface RoleShellProps {
  avatarUrl?: string | null;
  bottomItems: RoleShellItem[];
  browseHref: string;
  browseLabel: string;
  children: React.ReactNode;
  displayName: string;
  modeLabel: string;
  modeTone: string;
  primaryItems: RoleShellItem[];
  secondaryItems?: RoleShellItem[];
  switchHref: string;
  switchLabel: string;
}

function NavItem({
  item,
  pathname,
}: {
  item: RoleShellItem;
  pathname: string;
}) {
  const Icon = roleShellIcons[item.icon];
  const isActive =
    pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-brand-navy text-white"
          : "text-foreground hover:bg-brand-light hover:text-brand-navy",
      )}
      href={item.href}
    >
      <span className="flex items-center gap-3">
        <Icon className="size-4" />
        {item.label}
      </span>
      {typeof item.badge === "number" && item.badge > 0 ? (
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
            isActive ? "bg-white/20 text-white" : "bg-brand-light text-brand-navy",
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function RoleShell({
  avatarUrl,
  bottomItems,
  browseHref,
  browseLabel,
  children,
  displayName,
  modeLabel,
  modeTone,
  primaryItems,
  secondaryItems = [],
  switchHref,
  switchLabel,
}: RoleShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-brand-light">
      <aside className="hidden w-60 shrink-0 border-r border-border/70 bg-white lg:fixed lg:top-16 lg:bottom-0 lg:left-0 lg:block">
        <div className="flex h-full flex-col overflow-y-auto p-4">
          

          <nav className="space-y-5">
            <div className="space-y-1.5">
              {primaryItems.map((item) => (
                <NavItem item={item} key={item.href} pathname={pathname} />
              ))}
            </div>

            {secondaryItems.length > 0 ? (
              <>
                <Separator />
                <div className="space-y-1.5">
                  {secondaryItems.map((item) => (
                    <NavItem item={item} key={item.href} pathname={pathname} />
                  ))}
                </div>
              </>
            ) : null}
          </nav>

          <div className="mt-auto space-y-3 pt-6">
            <Separator />
            <Button asChild className="w-full bg-brand-navy text-white hover:bg-brand-steel">
              <Link href={switchHref}>{switchLabel}</Link>
            </Button>
            <Button asChild className="w-full" variant="outline">
              <Link href={browseHref}>{browseLabel}</Link>
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
        <div className="border-b border-border/70 bg-white px-4 py-3 lg:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{displayName}</p>
              <span className={cn("mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold", modeTone)}>
                {modeLabel}
              </span>
            </div>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={browseHref}>{browseLabel}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={switchHref}>{switchLabel}</Link>
              </Button>
            </div>
          </div>
        </div>

        <main className="min-h-[calc(100vh-4rem)] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white lg:hidden">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${bottomItems.length}, minmax(0, 1fr))` }}
        >
          {bottomItems.map((item) => {
            const Icon = roleShellIcons[item.icon];
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-2 py-3 text-[11px] font-medium transition-colors",
                  isActive ? "text-brand-navy" : "text-brand-steel",
                )}
                href={item.href}
                key={item.href}
              >
                <div className="relative">
                  <Icon className="size-5" />
                  {typeof item.badge === "number" && item.badge > 0 ? (
                    <span className="absolute -top-2 -right-3 inline-flex min-w-4 items-center justify-center rounded-full bg-brand-navy px-1 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
