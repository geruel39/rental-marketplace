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
      <div className="rounded-2xl border border-dashed border-border bg-brand-light p-4 text-sm text-brand-dark">
        Revenue chart - integrate charting library for production. `recharts` would be a
        good fit once interactive analytics are needed.
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {data.map((item) => (
          <div
            key={item.month}
            className="flex min-h-40 flex-col justify-end rounded-2xl border border-brand-navy/10 bg-white p-3 shadow-sm"
          >
            <div className="flex flex-1 items-end">
              <div className="w-full rounded-xl bg-brand-light p-1">
                <div
                  className="rounded-lg bg-gradient-to-t from-brand-navy to-brand-sky transition-all"
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


