"use client";

import { formatCurrency } from "@/lib/utils";

type AdminChartProps = {
  data: {
    month: string;
    revenue: number;
  }[];
};

export function AdminChart({ data }: AdminChartProps) {
  const maxRevenue = Math.max(...data.map((item) => item.revenue), 1);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-4 text-sm text-orange-900">
        Revenue chart - integrate charting library for production. `recharts` would be a
        good fit once interactive analytics are needed.
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {data.map((item) => (
          <div
            key={item.month}
            className="flex min-h-40 flex-col justify-end rounded-2xl border border-orange-100 bg-white/90 p-3 shadow-sm"
          >
            <div className="flex flex-1 items-end">
              <div className="w-full rounded-xl bg-orange-100 p-1">
                <div
                  className="rounded-lg bg-gradient-to-t from-orange-600 to-orange-400 transition-all"
                  style={{
                    height: `${Math.max(12, Math.round((item.revenue / maxRevenue) * 120))}px`,
                  }}
                />
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {item.month}
              </p>
              <p className="text-sm font-medium text-foreground">
                {formatCurrency(item.revenue)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
