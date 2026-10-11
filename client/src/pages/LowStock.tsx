import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Edit2, Package, Settings, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function LowStock() {
  const [, setLocation] = useLocation();
  const [thresholdDialogOpen, setThresholdDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<{ id: number; name: string; minStock: number } | null>(null);
  const [newThreshold, setNewThreshold] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: lowStockParts, isLoading } = trpc.parts.list.useQuery({ lowStock: true });
  const { data: allParts } = trpc.parts.list.useQuery({});

  const updateMutation = trpc.parts.update.useMutation({
    onSuccess: () => {
      utils.parts.list.invalidate();
      utils.dashboard.summary.invalidate();
      toast.success("Threshold updated");
      setThresholdDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  function openThresholdEdit(part: { id: number; name: string; minStock: number }) {
    setEditingPart(part);
    setNewThreshold(part.minStock.toString());
    setThresholdDialogOpen(true);
  }

  function handleThresholdSave() {
    if (!editingPart) return;
    const val = parseInt(newThreshold);
    if (isNaN(val) || val < 0) return toast.error("Invalid threshold value");
    updateMutation.mutate({ id: editingPart.id, minStock: val });
  }

  const criticalCount = lowStockParts?.filter((p) => p.stock === 0).length ?? 0;
  const warningCount = (lowStockParts?.length ?? 0) - criticalCount;

  return (
    <DashboardLayout>
      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
          <div className="relative aspect-square sm:aspect-video flex items-center justify-center">
            <img
              src={previewImage || ""}
              alt="Product Preview"
              className="max-h-full max-w-full object-contain"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20 h-12 w-12"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-8 w-8" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-6 w-full max-w-none">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">ของในร้าน</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              รายการทั้งหมด
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2 border-border text-muted-foreground"
            onClick={() => setLocation("/inventory")}
          >
            <Package className="h-4 w-4" />
            View All Inventory
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4.5 w-4.5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Low Stock</p>
                <p className="text-2xl font-bold text-foreground">{lowStockParts?.length ?? 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4.5 w-4.5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Out of Stock</p>
                <p className="text-2xl font-bold text-foreground">{criticalCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4.5 w-4.5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Healthy Stock</p>
                <p className="text-2xl font-bold text-foreground">
                  {(allParts?.length ?? 0) - (lowStockParts?.length ?? 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Table */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-0 pt-4 px-4 border-b border-border">
            <div className="flex items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                Items Requiring Attention ({lowStockParts?.length ?? 0})
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                <span className="text-xs text-muted-foreground">Out of stock</span>
                <div className="h-2 w-2 rounded-full bg-orange-400 ml-2" />
                <span className="text-xs text-muted-foreground">Low stock</span>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Photo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Part</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Supplier</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Stock</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Min Threshold</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-12 ml-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-12 ml-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20 mx-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-7 w-8 ml-auto" /></td>
                    </tr>
                  ))
                ) : lowStockParts && lowStockParts.length > 0 ? (
                  lowStockParts
                    .sort((a, b) => a.stock - b.stock)
                    .map((part) => {
                      const isOut = part.stock === 0;
                      return (
                        <tr key={part.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            {part.imageUrl ? (
                              <div className="relative group cursor-pointer" onClick={() => setPreviewImage(part.imageUrl)}>
                                <img
                                  src={part.imageUrl}
                                  alt={part.name}
                                  className="h-12 w-12 object-cover rounded-md border border-border"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                                  <Search className="h-4 w-4 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className="h-12 w-12 bg-muted rounded-md flex items-center justify-center border border-dashed border-border">
                                <span className="text-[8px] text-muted-foreground text-center px-1">No Photo</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full shrink-0 ${isOut ? "bg-red-400" : "bg-orange-400"}`} />
                                <span className="font-bold text-base text-foreground">{part.name}</span>
                              </div>
                              {part.imageUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-fit h-8 px-3 text-xs font-semibold"
                                  onClick={() => setPreviewImage(part.imageUrl)}
                                >
                                  <Search className="h-3.5 w-3.5 mr-1.5" />
                                  View Picture
                                </Button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            {part.category ? (
                              <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                                {part.category}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">
                            {part.supplierName ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge
                              variant="outline"
                              className={`text-xs font-bold ${
                                isOut
                                  ? "border-red-500/30 text-red-400 bg-red-500/10"
                                  : "border-orange-500/30 text-orange-400 bg-orange-500/10"
                              }`}
                            >
                              {part.stock}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                            {part.minStock}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                isOut
                                  ? "border-red-500/30 text-red-400 bg-red-500/10"
                                  : "border-orange-500/30 text-orange-400 bg-orange-500/10"
                              }`}
                            >
                              {isOut ? "Out of Stock" : "Low Stock"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                                title="Edit threshold"
                                onClick={() => openThresholdEdit({ id: part.id, name: part.name, minStock: part.minStock })}
                              >
                                <Settings className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                                title="Edit part"
                                onClick={() => setLocation("/inventory")}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <CheckCircle2 className="h-10 w-10 text-green-400/60 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">All stock levels are healthy</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        No parts are below their minimum stock threshold
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* All Parts Threshold Overview */}
        {allParts && allParts.length > 0 && (
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-0 pt-4 px-4 border-b border-border">
              <div className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">
                  All Parts — Stock Thresholds
                </CardTitle>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Part</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Min Threshold</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Health</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {allParts.map((part) => {
                    const isLow = part.stock <= part.minStock;
                    const pct = part.minStock > 0 ? Math.min(100, (part.stock / (part.minStock * 2)) * 100) : 100;
                    return (
                      <tr key={part.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{part.name}</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">{part.stock}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{part.minStock}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  part.stock === 0 ? "bg-red-400" : isLow ? "bg-orange-400" : "bg-green-400"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                            onClick={() => openThresholdEdit({ id: part.id, name: part.name, minStock: part.minStock })}
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Edit Threshold Dialog */}
      <Dialog open={thresholdDialogOpen} onOpenChange={setThresholdDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Min Stock Threshold</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Set the minimum stock level for <span className="font-semibold text-foreground">{editingPart?.name}</span>.
              An alert will be shown when stock falls to or below this value.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Minimum Stock Threshold</Label>
              <Input
                type="number"
                min="0"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                className="bg-input border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThresholdDialogOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button onClick={handleThresholdSave} disabled={updateMutation.isPending}>
              Save Threshold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
