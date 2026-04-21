import Link from "next/link";
import { headers } from "next/headers";
import {
  Bell,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  User as UserIcon,
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
  Sheet,
  SheetClose,
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

const authenticatedMobileSections = [
  {
    title: "Dashboards",
    items: [
      { href: "/renter/dashboard", label: "Renter Dashboard", icon: LayoutDashboard },
      { href: "/lister/dashboard", label: "Lister Dashboard", icon: LayoutDashboard },
      { href: "/listings", label: "Browse Items", icon: Compass },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/account/notifications", label: "Notifications", icon: Bell },
      { href: "/account/messages", label: "Messages", icon: MessageSquare },
      { href: "/account/profile", label: "Account Settings", icon: Settings },
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
  let profile:
    | Pick<Profile, "avatar_url" | "display_name" | "full_name" | "is_admin">
    | null = null;
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
        .maybeSingle<
          Pick<Profile, "avatar_url" | "display_name" | "full_name" | "is_admin">
        >();

      profile = userProfile ?? null;

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
  const avatarUrl =
    profile?.avatar_url ??
    (typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : undefined);
  const isAdmin = profile?.is_admin ?? false;

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
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-sm">
              <SheetHeader className="-mx-6 -mt-6 mb-4 bg-brand-navy px-6 py-5 text-white">
                <SheetTitle className="text-white">RentHub</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6">
                <SearchBar />
                {!user ? (
                  <div className="grid gap-2">
                    <SheetClose asChild>
                      <Button asChild className="justify-start" variant="ghost">
                        <Link href="/listings">Browse Items</Link>
                      </Button>
                    </SheetClose>
                    {publicNavItems.map((item) => (
                      <SheetClose key={item.href} asChild>
                        <Button
                          asChild
                          className={item.href === "/register" ? "bg-brand-navy text-white hover:bg-brand-steel" : "justify-start"}
                          variant={item.href === "/register" ? "default" : "ghost"}
                        >
                          <Link href={item.href}>{item.label}</Link>
                        </Button>
                      </SheetClose>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {authenticatedMobileSections.map((section) => (
                      <div className="space-y-2" key={section.title}>
                        <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-navy/70">
                          {section.title}
                        </p>
                        <div className="grid gap-1">
                          {section.items.map((item) => {
                            const Icon = item.icon;

                            return (
                              <SheetClose asChild key={item.href}>
                                <Button asChild className="justify-start" variant="ghost">
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
                      <Button asChild className="justify-start" variant="ghost">
                        <Link href={`/users/${user.id}`}>
                          <UserIcon className="size-4" />
                          My Profile
                        </Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild className="justify-start" variant="ghost">
                        <a href="/auth/logout">
                          <LogOut className="size-4" />
                          Logout
                        </a>
                      </Button>
                    </SheetClose>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Link
            className="rounded-sm text-xl font-bold tracking-tight text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
          >
            RentHub
          </Link>
        </div>

        <div className="hidden flex-1 justify-center xl:flex">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!user ? (
            <div className="hidden items-center gap-2 lg:flex">
              <Button asChild variant="ghost">
                <Link href="/listings">Browse</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild className="bg-brand-navy text-white hover:bg-brand-steel">
                <Link href="/register">Sign Up</Link>
              </Button>
            </div>
          ) : (
            <>
              <Button asChild className="hidden lg:inline-flex" variant="ghost">
                <Link href="/listings">
                  <Compass className="size-4" />
                  Browse
                </Link>
              </Button>
              <NotificationBell
                initialNotifications={latestNotifications}
                initialUnreadCount={unreadNotifications}
                userId={user.id}
              />
              <Button asChild size="icon" variant="ghost">
                <Link aria-label="Messages" href="/account/messages">
                  <MessageSquare className="size-5" />
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="Open account menu"
                    className="flex items-center gap-2 rounded-full pl-1 pr-2"
                    variant="ghost"
                  >
                    <Avatar className="size-8">
                      <AvatarImage alt={displayName} src={avatarUrl} />
                      <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium lg:inline">
                      {displayName}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem asChild>
                    <Link href="/renter/dashboard">
                      <LayoutDashboard className="size-4" />
                      Renter Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/lister/dashboard">
                      <LayoutDashboard className="size-4" />
                      Lister Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/listings">
                      <Compass className="size-4" />
                      Browse Items
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/users/${user.id}`}>
                      <UserIcon className="size-4" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/profile">
                      <Settings className="size-4" />
                      Account Settings
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
