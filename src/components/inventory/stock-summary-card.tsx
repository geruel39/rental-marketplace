import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CircleOff,
  PackageCheck,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InventorySummary } from "@/types";

interface StockSummaryCardProps {
  summary: InventorySummary;
}

const stats = [
  {
    key: "total",
    label: "Total Items",
    value: (summary: InventorySummary) => summary.totalItemsAvailable,
    icon: Boxes,
    iconClassName: "bg-blue-100 text-blue-700",
  },
  {
    key: "in-stock",
    label: "In Stock",
    value: (summary: InventorySummary) => summary.inStockCount,
    icon: PackageCheck,
    iconClassName: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "low-stock",
    label: "Low Stock",
    value: (summary: InventorySummary) => summary.lowStockCount,
    icon: AlertTriangle,
    iconClassName: "bg-amber-100 text-amber-700",
  },
  {
    key: "out-of-stock",
    label: "Out of Stock",
    value: (summary: InventorySummary) => summary.outOfStockCount,
    icon: CircleOff,
    iconClassName: "bg-rose-100 text-rose-700",
  },
];

export function StockSummaryCard({ summary }: StockSummaryCardProps) {
  return (
    <Link className="block" href="/dashboard/inventory">
      <Card className="border-border/70 transition-shadow hover:shadow-md">
        <CardHeader className="gap-1">
          <CardTitle>Inventory Summary</CardTitle>
          <CardDescription>
            Track your live stock levels across all active listings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.key}
                  className="rounded-2xl border border-border/70 bg-muted/30 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-10 items-center justify-center rounded-full ${stat.iconClassName}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{stat.value(summary)}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
