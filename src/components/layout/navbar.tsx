import Link from "next/link";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  User as UserIcon,
} from "lucide-react";

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
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/utils";

const publicNavItems = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Sign Up" },
];

const loggedInNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export async function Navbar() {
  let user:
    | {
        id: string;
        email?: string;
        user_metadata?: Record<string, unknown>;
      }
    | null = null;

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    user = sessionUser;
  }

  const displayName =
    (typeof user?.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : null) ??
    (typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null) ??
    user?.email ??
    "User";
  const avatarUrl =
    typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">
              <Menu className="size-5" />
              <span className="sr-only">Open navigation</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-sm">
              <SheetHeader>
                <SheetTitle>RentHub</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 px-4 pb-6">
                <SearchBar />
                <div className="space-y-3">
                  <Button asChild className="w-full justify-start">
                    <Link href="/listings/new">
                      <Plus className="size-4" />
                      List an Item
                    </Link>
                  </Button>

                  {!user ? (
                    <div className="grid gap-2">
                      {publicNavItems.map((item) => (
                        <Button
                          key={item.href}
                          asChild
                          className="justify-start"
                          variant={item.href === "/register" ? "default" : "ghost"}
                        >
                          <Link href={item.href}>{item.label}</Link>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {loggedInNavItems.map((item) => {
                        const Icon = item.icon;

                        return (
                          <Button
                            key={item.href}
                            asChild
                            className="justify-start"
                            variant="ghost"
                          >
                            <Link href={item.href}>
                              <Icon className="size-4" />
                              {item.label}
                            </Link>
                          </Button>
                        );
                      })}
                      <Button asChild className="justify-start" variant="ghost">
                        <Link href={`/users/${user.id}`}>
                          <UserIcon className="size-4" />
                          My Profile
                        </Link>
                      </Button>
                      <Button asChild className="justify-start" variant="ghost">
                        <a href="/auth/logout">
                          <LogOut className="size-4" />
                          Logout
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link className="text-xl font-semibold tracking-tight" href="/">
            RentHub
          </Link>
        </div>

        <div className="hidden flex-1 justify-center md:flex">
          <SearchBar />
        </div>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {!user ? (
            <>
              <Button asChild variant="ghost">
                <Link href="/listings/new">List an Item</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Sign Up</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild>
                <Link href="/listings/new">List an Item</Link>
              </Button>
              <Button size="icon" variant="ghost">
                <Bell className="size-5" />
                <span className="sr-only">Notifications</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="rounded-full p-0" size="icon" variant="ghost">
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
