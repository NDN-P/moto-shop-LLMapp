import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { BarChart3, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Period = "day" | "week" | "month";

type TopSellerRow = {
  partId: number;
  partName: string;
  partCategory: string | null;
  totalOut: number;
};


const PERIOD_LABELS: Record<Period, string> = {
  day: "Daily (Last 30 days)",
  week: "Weekly (Last 12 weeks)",
  month: "Monthly (Last 12 months)",
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-medium text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-medium text-foreground">${Number(p.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export default function SalesTrends() {
  const [period, setPeriod] = useState<Period>("day");

  const { data: trends, isLoading } = trpc.dashboard.trends.useQuery({ period });
  const { data: topSellers } = trpc.dashboard.topSellers.useQuery({ limit: 10 });
  const sellerRows = (topSellers ?? []) as TopSellerRow[];

  const chartData = useMemo(() => {
    if (!trends) return [];

    const map = new Map<string, { period: string; in: number; out: number; revenue: number }>();
    for (const row of trends) {
      const key = row.period;
      if (!map.has(key)) {
        map.set(key, { period: key, in: 0, out: 0, revenue: 0 });
      }
      const entry = map.get(key)!;
      if (row.type === "in") {
        entry.in += Number(row.total);
      } else {
        entry.out += Number(row.total);
        entry.revenue += Number(row.revenue ?? 0);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [trends]);

  const totalSales = chartData.reduce((s, d) => s + d.out, 0);
  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0);
  const totalIn = chartData.reduce((s, d) => s + d.in, 0);

  const tickFormatter = (value: string) => {
    if (period === "day") return value.slice(5); // MM-DD
    if (period === "week") {
      const [year, week] = value.split("-");
      return `W${week}`;
    }
    return value.slice(0, 7); // YYYY-MM
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Sales Trends</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visualize stock movements and revenue over time
            </p>
          </div>
          {/* Period Toggle */}
          <div className="flex gap-2">
            {(["day", "week", "month"] as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(p)}
                className={`capitalize h-8 ${period !== p ? "border-border text-muted-foreground" : ""}`}
              >
                {p === "day" ? "Daily" : p === "week" ? "Weekly" : "Monthly"}
              </Button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Sales</p>
              <p className="text-2xl font-bold text-foreground mt-1">{totalSales}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{PERIOD_LABELS[period]}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Revenue</p>
              <p className="text-2xl font-bold text-foreground mt-1">{totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{PERIOD_LABELS[period]}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Stock Received</p>
              <p className="text-2xl font-bold text-foreground mt-1">{totalIn}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{PERIOD_LABELS[period]}</p>
            </CardContent>
          </Card>
        </div>

        {/* Stock Movement Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4 border-b border-border">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Stock Movement — {PERIOD_LABELS[period]}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.018 250)" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickFormatter={tickFormatter}
                    tick={{ fill: "oklch(0.58 0.015 250)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.58 0.015 250)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", color: "oklch(0.58 0.015 250)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="out"
                    name="Sales Out"
                    stroke="oklch(0.72 0.18 220)"
                    strokeWidth={2}
                    dot={{ fill: "oklch(0.72 0.18 220)", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="in"
                    name="Stock In"
                    stroke="oklch(0.68 0.18 145)"
                    strokeWidth={2}
                    dot={{ fill: "oklch(0.68 0.18 145)", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <TrendingUp className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No movement data available</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Record stock movements to see trends</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4 border-b border-border">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Revenue — {PERIOD_LABELS[period]}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.018 250)" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickFormatter={tickFormatter}
                    tick={{ fill: "oklch(0.58 0.015 250)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.58 0.015 250)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="oklch(0.72 0.18 220)"
                    radius={[4, 4, 0, 0]}
                    fillOpacity={0.85}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No revenue data available</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Record stock-out movements with unit prices to track revenue</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Sellers Table */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-0 pt-4 px-4 border-b border-border">
            <div className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Top Selling Parts</CardTitle>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Part</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Units Sold</th>
                </tr>
              </thead>
              <tbody>
                {!topSellers ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    </tr>
                  ))
                ) : topSellers.length > 0 ? (
                  topSellers.map((item, idx) => (
                    <tr key={item.partId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground font-bold text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{item.partName}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {item.partCategory ? (
                          <span className="text-xs text-muted-foreground">{item.partCategory}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-primary">{Number(item.totalOut)}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <p className="text-sm text-muted-foreground">No sales data yet</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
