import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Package,
  RefreshCw,
  Truck,
} from "lucide-react";
import { useLocation } from "wouter";

type TopSellerRow = {
  partId: number;
  partName: string;
  partCategory: string | null;
  totalOut: number;
};


function StatCard({
  title,
  value,
  icon: Icon,
  color,
  sub,
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`bg-card border-border transition-all duration-200 hover:border-border/80 hover:shadow-lg ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: summary, isLoading: summaryLoading } = trpc.dashboard.summary.useQuery();
  const { data: topSellers, isLoading: topLoading } = trpc.dashboard.topSellers.useQuery({ limit: 5 });
  const { data: recentMovements, isLoading: movementsLoading } = trpc.stock.list.useQuery({ limit: 8 });
  const { data: lowStockParts, isLoading: lowStockLoading } = trpc.parts.list.useQuery({ lowStock: true });
  const sellerRows = (topSellers ?? []) as TopSellerRow[];

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full max-w-none">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of your motorcycle parts shop
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-24 mb-3" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatCard
                title="Total Parts"
                value={summary?.totalParts ?? 0}
                icon={Package}
                color="bg-primary/10 text-primary"
                sub="Active inventory items"
                onClick={() => setLocation("/inventory")}
              />
              <StatCard
                title="Low Stock"
                value={summary?.lowStockCount ?? 0}
                icon={AlertTriangle}
                color={
                  (summary?.lowStockCount ?? 0) > 0
                    ? "bg-orange-500/10 text-orange-400"
                    : "bg-green-500/10 text-green-400"
                }
                sub="Items below threshold"
                onClick={() => setLocation("/low-stock")}
              />
              <StatCard
                title="Suppliers"
                value={summary?.totalSuppliers ?? 0}
                icon={Truck}
                color="bg-violet-500/10 text-violet-400"
                sub="Active suppliers"
                onClick={() => setLocation("/suppliers")}
              />
              <StatCard
                title="Today's Movements"
                value={summary?.totalMovementsToday ?? 0}
                icon={RefreshCw}
                color="bg-cyan-500/10 text-cyan-400"
                sub="Stock transactions today"
                onClick={() => setLocation("/stock")}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Transactions */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Recent Transactions</CardTitle>
                <button
                  onClick={() => setLocation("/stock")}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  View all
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {movementsLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-3.5 w-32 mb-1.5" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : recentMovements && recentMovements.length > 0 ? (
                <div className="divide-y divide-border">
                  {recentMovements.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          m.type === "in"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {m.type === "in" ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {m.partName ?? "Unknown Part"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-xs font-medium ${
                            m.type === "in"
                              ? "border-green-500/30 text-green-400 bg-green-500/10"
                              : "border-red-500/30 text-red-400 bg-red-500/10"
                          }`}
                        >
                          {m.type === "in" ? "+" : "-"}{m.quantity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <RefreshCw className="h-8 w-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No transactions yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Record your first stock movement to get started</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="space-y-4 w-full max-w-none">
            {/* Top Sellers */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground">Top Sellers</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {topLoading ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-3.5 flex-1" />
                        <Skeleton className="h-4 w-10" />
                      </div>
                    ))}
                  </div>
                ) : sellerRows.length > 0 ? (
                  <div className="divide-y divide-border">
                    {sellerRows.map((item, idx) => (
                      <div key={item.partId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                        <span className="text-xs font-bold text-muted-foreground w-4">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.partName}</p>
                          {item.partCategory && (
                            <p className="text-xs text-muted-foreground">{item.partCategory}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/10">
                          {Number(item.totalOut)} sold
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <BarChart3 className="h-7 w-7 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">No sales data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Low Stock Alert */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground">Low Stock Alerts</CardTitle>
                  <button
                    onClick={() => setLocation("/low-stock")}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    View all
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {lowStockLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full rounded-lg" />
                    ))}
                  </div>
                ) : lowStockParts && lowStockParts.length > 0 ? (
                  <div className="divide-y divide-border">
                    {lowStockParts.slice(0, 5).map((part) => (
                      <div key={part.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{part.name}</p>
                        </div>
                        <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400 bg-orange-500/10 shrink-0">
                          {part.stock}/{part.minStock}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Package className="h-7 w-7 text-green-400/60 mb-2" />
                    <p className="text-xs text-muted-foreground">All stock levels OK</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
