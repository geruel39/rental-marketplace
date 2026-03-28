"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowUpDown,
  Ban,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  UserRound,
} from "lucide-react";

import {
  suspendUser,
  toggleAdminRole,
  unsuspendUser,
} from "@/actions/admin";
import { Pagination } from "@/components/shared/pagination";
import { UserSuspendDialog } from "@/components/admin/user-suspend-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, getInitials } from "@/lib/utils";
import type { Profile } from "@/types";

type SortKey = "name" | "joined" | "rating" | "listings";

type AdminUserTableProps = {
  users: Profile[];
  totalCount: number;
  currentPage: number;
  totalPages?: number;
};

function getStatusLabel(user: Profile) {
  return user.is_suspended ? "Suspended" : "Active";
}

function getFilterValue(searchParams: URLSearchParams) {
  const status = searchParams.get("status");
  const accountType = searchParams.get("accountType");

  if (status === "active" || status === "suspended") {
    return status;
  }

  if (accountType === "business" || accountType === "individual") {
    return accountType;
  }

  return "all";
}

export function AdminUserTable({
  users,
  totalCount,
  currentPage,
  totalPages = 0,
}: AdminUserTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") ?? "");
  const [isPending, startTransition] = useTransition();

  const sort = (searchParams.get("sort") as SortKey | null) ?? "joined";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const activeFilter = getFilterValue(searchParams);

  const sortedUsers = useMemo(() => {
    const copy = [...users];

    copy.sort((a, b) => {
      let comparison = 0;

      switch (sort) {
        case "name":
          comparison = (a.display_name || a.full_name || a.email).localeCompare(
            b.display_name || b.full_name || b.email,
          );
          break;
        case "rating":
          comparison = a.rating_as_lister - b.rating_as_lister;
          break;
        case "listings":
          comparison = a.total_listings - b.total_listings;
          break;
        case "joined":
        default:
          comparison =
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }

      return order === "asc" ? comparison : -comparison;
    });

    return copy;
  }, [order, sort, users]);

  function updateParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function handleSearchSubmit() {
    updateParams((params) => {
      if (searchValue.trim()) {
        params.set("search", searchValue.trim());
      } else {
        params.delete("search");
      }
      params.delete("page");
    });
  }

  function handleFilterChange(value: string) {
    updateParams((params) => {
      params.delete("page");
      params.delete("status");
      params.delete("accountType");

      if (value === "active" || value === "suspended") {
        params.set("status", value);
      }

      if (value === "business" || value === "individual") {
        params.set("accountType", value);
      }
    });
  }

  function toggleSort(nextSort: SortKey) {
    updateParams((params) => {
      const currentSort = params.get("sort");
      const currentOrder = params.get("order") === "asc" ? "asc" : "desc";

      params.set("sort", nextSort);
      params.set(
        "order",
        currentSort === nextSort && currentOrder === "desc" ? "asc" : "desc",
      );
    });
  }

  async function handleToggleAdmin(user: Profile) {
    startTransition(async () => {
      await toggleAdminRole(user.id, !user.is_admin);
      router.refresh();
    });
  }

  async function handleUnsuspend(user: Profile) {
    startTransition(async () => {
      await unsuspendUser(user.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 gap-2">
          <Input
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSearchSubmit();
              }
            }}
            placeholder="Search by name or email"
            value={searchValue}
          />
          <Button
            disabled={isPending}
            onClick={handleSearchSubmit}
            type="button"
            variant="outline"
          >
            Search
          </Button>
        </div>

        <Tabs onValueChange={handleFilterChange} value={activeFilter}>
          <TabsList variant="line" className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="suspended">Suspended</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="individual">Individual</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-3xl border border-orange-200/60 bg-white/90 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Avatar</TableHead>
              <TableHead>
                <button
                  className="inline-flex items-center gap-2"
                  onClick={() => toggleSort("name")}
                  type="button"
                >
                  Name
                  <ArrowUpDown className="size-4" />
                </button>
              </TableHead>
              <TableHead>Account Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>
                <button
                  className="inline-flex items-center gap-2"
                  onClick={() => toggleSort("joined")}
                  type="button"
                >
                  Joined
                  <ArrowUpDown className="size-4" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="inline-flex items-center gap-2"
                  onClick={() => toggleSort("rating")}
                  type="button"
                >
                  Rating
                  <ArrowUpDown className="size-4" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="inline-flex items-center gap-2"
                  onClick={() => toggleSort("listings")}
                  type="button"
                >
                  Listings
                  <ArrowUpDown className="size-4" />
                </button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.length === 0 ? (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={9}>
                  No users matched the current filters.
                </TableCell>
              </TableRow>
            ) : (
              sortedUsers.map((user) => {
                const displayName = user.display_name || user.full_name || user.email;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar size="sm">
                        {user.avatar_url ? (
                          <AvatarImage alt={displayName} src={user.avatar_url} />
                        ) : null}
                        <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div>
                        <p className="font-medium text-foreground">{displayName}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {user.account_type === "business" ? "Business" : "Individual"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.is_suspended
                            ? "bg-red-600 text-white hover:bg-red-600"
                            : "bg-emerald-600 text-white hover:bg-emerald-600"
                        }
                      >
                        {getStatusLabel(user)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.is_admin ? (
                        <Badge className="bg-orange-600 text-white hover:bg-orange-600">
                          Admin
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>{user.rating_as_lister.toFixed(1)}</TableCell>
                    <TableCell>{user.total_listings}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/users/${user.id}`}>
                              <UserRound className="size-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.is_suspended ? (
                            <DropdownMenuItem onClick={() => void handleUnsuspend(user)}>
                              <ShieldCheck className="size-4" />
                              Unsuspend
                            </DropdownMenuItem>
                          ) : (
                            <UserSuspendDialog
                              onConfirm={async (reason) => {
                                await suspendUser(user.id, reason);
                                router.refresh();
                              }}
                              trigger={
                                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                                  <Ban className="size-4" />
                                  Suspend
                                </DropdownMenuItem>
                              }
                              user={user}
                            />
                          )}
                          <DropdownMenuItem onClick={() => void handleToggleAdmin(user)}>
                            {user.is_admin ? (
                              <>
                                <ShieldOff className="size-4" />
                                Remove Admin
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="size-4" />
                                Make Admin
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {sortedUsers.length} of {totalCount.toLocaleString()} users
        </p>
        <Pagination currentPage={currentPage} totalPages={totalPages} />
      </div>
    </div>
  );
}
