import Link from "next/link";
import { Clock3 } from "lucide-react";
import { redirect } from "next/navigation";

import { getInventoryOverview, getLowStockListings } from "@/actions/inventory";
import { LowStockAlert } from "@/components/inventory/low-stock-alert";
import { StockOverviewTable } from "@/components/inventory/stock-overview-table";
import { StockSummaryCard } from "@/components/inventory/stock-summary-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function InventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ listings, summary }, lowStockListings] = await Promise.all([
    getInventoryOverview(user.id),
    getLowStockListings(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Watch stock health across all listings and react quickly to low inventory.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/inventory/adjustments">
            <Clock3 className="size-4" />
            View Adjustment History
          </Link>
        </Button>
      </div>

      <LowStockAlert listings={lowStockListings} />
      <StockSummaryCard summary={summary} />
      <StockOverviewTable listings={listings} />
    </div>
  );
}
