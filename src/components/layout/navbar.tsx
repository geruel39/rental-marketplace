import Link from "next/link";
import { headers } from "next/headers";
import {
  Bell,
  CreditCard,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Plus,
  Receipt,
  Settings,
  ShieldCheck,
  Shield,
  Star,
  User as UserIcon,
  Wallet,
} from "lucide-react";

import { getNotifications, getUnreadCount } from "@/actions/notifications";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SearchBar } from "@/components/shared/search-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SheetClose,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/utils";
import type { Notification, Profile } from "@/types";

const publicNavItems = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Sign Up" },
];

const mobileDashboardSections = [
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
] as const;

export async function Navbar() {
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";

  if (pathname === "/maintenance") {
    return null;
  }

  let user:
    | {
        id: string;
        email?: string;
        user_metadata?: Record<string, unknown>;
      }
    | null = null;
  let profile: Pick<Profile, "avatar_url" | "display_name" | "full_name"> | null = null;
  let isAdmin = false;
  let latestNotifications: Notification[] = [];
  let unreadNotifications = 0;

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    user = sessionUser;

    if (sessionUser) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("avatar_url, display_name, full_name, is_admin")
        .eq("id", sessionUser.id)
        .maybeSingle<Pick<Profile, "avatar_url" | "display_name" | "full_name" | "is_admin">>();

      profile = userProfile ?? null;
      isAdmin = userProfile?.is_admin ?? false;

      const [notifications, unreadCount] = await Promise.all([
        getNotifications(sessionUser.id, 1),
        getUnreadCount(sessionUser.id),
      ]);

      latestNotifications = notifications.data.slice(0, 5);
      unreadNotifications = unreadCount;
    }
  }

  const displayName =
    profile?.display_name ??
    profile?.full_name ??
    (typeof user?.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : null) ??
    (typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null) ??
    user?.email ??
    "User";
  const avatarUrl = profile?.avatar_url ??
    (typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : undefined);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger
              aria-label="Open navigation menu"
              className="inline-flex size-9 items-center justify-center rounded-md text-brand-navy transition-colors hover:bg-brand-light hover:text-brand-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              <Menu className="size-5" />
              <span className="sr-only">Open navigation</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-sm">
              <SheetHeader className="-mx-6 -mt-6 mb-4 bg-brand-navy px-6 py-5 text-white">
                <SheetTitle className="text-white">RentHub</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6">
                <SearchBar />
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <SheetClose asChild>
                      <Button asChild className="justify-start text-brand-navy hover:bg-brand-light hover:text-brand-steel" variant="ghost">
                        <Link href="/">Home</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild className="justify-start text-brand-navy hover:bg-brand-light hover:text-brand-steel" variant="ghost">
                        <Link href="/listings">Browse Listings</Link>
                      </Button>
                    </SheetClose>
                  </div>
                  <SheetClose asChild>
                    <Button asChild className="w-full justify-start bg-brand-navy text-white hover:bg-brand-steel">
                      <Link href="/listings/new">
                        <Plus className="size-4" />
                        List an Item
                      </Link>
                    </Button>
                  </SheetClose>

                  {!user ? (
                    <div className="grid gap-2">
                      {publicNavItems.map((item) => (
                        <SheetClose key={item.href} asChild>
                          <Button
                            asChild
                            className={item.href === "/register"
                              ? "justify-start bg-brand-navy text-white hover:bg-brand-steel"
                              : "justify-start text-brand-navy hover:bg-brand-light hover:text-brand-steel"}
                            variant={item.href === "/register" ? "default" : "ghost"}
                          >
                            <Link href={item.href}>{item.label}</Link>
                          </Button>
                        </SheetClose>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {mobileDashboardSections.map((section) => (
                        <div key={section.title} className="space-y-2">
                          <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy/70">
                            {section.title}
                          </p>
                          <div className="grid gap-1">
                            {section.items.map((item) => {
                              const Icon = item.icon;

                              return (
                                <SheetClose key={item.href} asChild>
                                  <Button
                                    asChild
                                    className="justify-start text-brand-navy hover:bg-brand-light hover:text-brand-steel"
                                    variant="ghost"
                                  >
                                    <Link href={item.href}>
                                      <Icon className="size-4" />
                                      {item.label}
                                    </Link>
                                  </Button>
                                </SheetClose>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <SheetClose asChild>
                        <Button
                          asChild
                          className="justify-start text-brand-navy hover:bg-brand-light hover:text-brand-steel"
                          variant="ghost"
                        >
                          <Link href={`/users/${user.id}`}>
                            <UserIcon className="size-4" />
                            My Profile
                          </Link>
                        </Button>
                      </SheetClose>
                      <SheetClose asChild>
                        <Button
                          asChild
                          className="justify-start text-brand-navy hover:bg-brand-light hover:text-brand-steel"
                          variant="ghost"
                        >
                          <a href="/auth/logout">
                            <LogOut className="size-4" />
                            Logout
                          </a>
                        </Button>
                      </SheetClose>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link
            className="text-brand-navy rounded-sm text-xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
          >
            RentHub
          </Link>
        </div>

        <div className="hidden flex-1 justify-center xl:flex">
          <SearchBar />
        </div>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {!user ? (
            <>
              <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel">
                <Link href="/listings/new">List an Item</Link>
              </Button>
              <Button asChild className="border-brand-navy text-brand-navy hover:bg-brand-navy/10 hover:text-brand-steel" variant="outline">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel">
                <Link href="/register">Sign Up</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel">
                <Link href="/listings/new">List an Item</Link>
              </Button>
              <NotificationBell
                initialNotifications={latestNotifications}
                initialUnreadCount={unreadNotifications}
                userId={user.id}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="Open account menu"
                    className="rounded-full p-0"
                    size="icon"
                    variant="ghost"
                  >
                    <Avatar>
                      {avatarUrl ? <AvatarImage alt={displayName} src={avatarUrl} /> : null}
                      <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">
                      <LayoutDashboard className="size-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/users/${user.id}`}>
                      <UserIcon className="size-4" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <Settings className="size-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin ? (
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <Shield className="size-4 text-brand-sky" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/auth/logout">
                      <LogOut className="size-4" />
                      Logout
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
