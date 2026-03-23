"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

function getPageNumbers(currentPage: number, totalPages: number) {
  const pages = new Set<number>([1, totalPages, currentPage]);

  for (let offset = 1; offset <= 1; offset += 1) {
    if (currentPage - offset > 1) {
      pages.add(currentPage - offset);
    }

    if (currentPage + offset < totalPages) {
      pages.add(currentPage + offset);
    }
  }

  return Array.from(pages).sort((a, b) => a - b).slice(0, 5);
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) {
    return null;
  }

  const pages = getPageNumbers(currentPage, totalPages);

  function goToPage(page: number) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (page <= 1) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(page));
    }

    const queryString = nextParams.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button
        disabled={currentPage <= 1}
        onClick={() => goToPage(currentPage - 1)}
        type="button"
        variant="outline"
      >
        <ChevronLeft className="size-4" />
        Previous
      </Button>

      {pages.map((page, index) => {
        const previousPage = pages[index - 1];
        const showEllipsis = previousPage !== undefined && page - previousPage > 1;

        return (
          <div key={page} className="flex items-center gap-2">
            {showEllipsis ? (
              <span className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground">
                <MoreHorizontal className="size-4" />
              </span>
            ) : null}
            <Button
              onClick={() => goToPage(page)}
              type="button"
              variant={page === currentPage ? "default" : "outline"}
            >
              {page}
            </Button>
          </div>
        );
      })}

      <Button
        disabled={currentPage >= totalPages}
        onClick={() => goToPage(currentPage + 1)}
        type="button"
        variant="outline"
      >
        Next
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
