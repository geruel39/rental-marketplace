import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="rounded-full bg-muted p-5">
        <SearchX className="size-10 text-muted-foreground" />
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Page Not Found</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        The page you were looking for does not exist or may have been moved.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}
