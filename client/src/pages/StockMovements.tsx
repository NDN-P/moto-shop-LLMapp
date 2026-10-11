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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownRight,
  ArrowUpRight,
  Edit2,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type MovementForm = {
  partId: string;
  type: "in" | "out";
  quantity: string;
  unitPrice: string;
  reference: string;
  note: string;
};

type MovementRow = {
  id: number;
  partId: number;
  type: "in" | "out";
  quantity: number;
  unitPrice?: string | null;
  reference?: string | null;
  note?: string | null;
  createdAt: string | number | Date;
  partName?: string | null;
  partCategory?: string | null;
};

const emptyForm: MovementForm = {
  partId: "",
  type: "out",
  quantity: "1",
  unitPrice: "",
  reference: "",
  note: "",
};

export default function StockMovements() {
  const [typeFilter, setTypeFilter] = useState<"all" | "in" | "out">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingMovement, setDeletingMovement] = useState<MovementRow | null>(null);
  const [form, setForm] = useState<MovementForm>(emptyForm);
  const [partSearch, setPartSearch] = useState("");

  const utils = trpc.useUtils();

  const refreshAll = () => {
    utils.stock.list.invalidate();
    utils.parts.list.invalidate();
    utils.dashboard.summary.invalidate();
    utils.dashboard.topSellers.invalidate();
    utils.dashboard.trends.invalidate();
  };

  const { data: movements, isLoading } = trpc.stock.list.useQuery({
    type: typeFilter !== "all" ? typeFilter : undefined,
    limit: 100,
  });

  const { data: parts } = trpc.parts.list.useQuery({});

  const filteredParts = (parts ?? []).filter((part) => {
    const q = partSearch.trim().toLowerCase();
    if (!q) return true;

    return (
      part.name.toLowerCase().includes(q) ||
      part.sku?.toLowerCase().includes(q) ||
      part.category?.toLowerCase().includes(q)
    );
  });

  const recordMutation = trpc.stock.record.useMutation({
    onSuccess: () => {
      refreshAll();
      toast.success(`Stock ${form.type === "in" ? "in" : "out"} recorded successfully`);
      setDialogOpen(false);
      setPartSearch("");
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.stock.update.useMutation({
    onSuccess: () => {
      refreshAll();
      toast.success("Stock movement updated");
      setDialogOpen(false);
      setEditingId(null);
      setPartSearch("");
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.stock.delete.useMutation({
    onSuccess: () => {
      refreshAll();
      toast.success("Stock movement deleted and stock updated");
      setDeleteDialogOpen(false);
      setDeletingMovement(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreateDialog() {
    setEditingId(null);
    setPartSearch("");
    setForm({ ...emptyForm, type: "out" });
    setDialogOpen(true);
  }

  function openEditDialog(movement: MovementRow) {
    setEditingId(movement.id);
    setPartSearch("");
    setForm({
      partId: movement.partId.toString(),
      type: movement.type,
      quantity: movement.quantity.toString(),
      unitPrice: movement.unitPrice ? String(movement.unitPrice) : "",
      reference: movement.reference ?? "",
      note: movement.note ?? "",
    });
    setDialogOpen(true);
  }

  function handlePartChange(nextPartId: string) {
    if (nextPartId === "none") {
      setForm((prev) => ({ ...prev, partId: "", unitPrice: "" }));
      return;
    }

    const selectedPart = parts?.find((part) => part.id.toString() === nextPartId);
    setForm((prev) => ({
      ...prev,
      partId: nextPartId,
      unitPrice: selectedPart?.price?.toString() ?? prev.unitPrice,
    }));
  }

  function handleSubmit() {
    if (!form.partId) {
      return toast.error("Please select a part");
    }

    if (!form.quantity || parseInt(form.quantity, 10) < 1) {
      return toast.error("Quantity must be at least 1");
    }

    const payload = {
      partId: parseInt(form.partId, 10),
      type: form.type,
      quantity: parseInt(form.quantity, 10),
      unitPrice: form.unitPrice ? parseFloat(form.unitPrice).toFixed(2) : undefined,
      reference: form.reference || undefined,
      note: form.note || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
      return;
    }

    recordMutation.mutate(payload);
  }

  const totalIn =
    movements?.filter((m) => m.type === "in").reduce((sum, movement) => sum + movement.quantity, 0) ?? 0;

  const totalOut =
    movements?.filter((m) => m.type === "out").reduce((sum, movement) => sum + movement.quantity, 0) ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full max-w-none">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Stock In / Out</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Record, edit, and fix stock movement mistakes easily
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Record Movement
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                <ArrowUpRight className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total In</p>
                <p className="text-2xl font-bold text-foreground">{totalIn}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <ArrowDownRight className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Out</p>
                <p className="text-2xl font-bold text-foreground">{totalOut}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-2">
            {(["all", "in", "out"] as const).map((t) => (
              <Button
                key={t}
                variant={typeFilter === t ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(t)}
                className={`capitalize h-8 ${typeFilter !== t ? "border-border text-muted-foreground" : ""}`}
              >
                {t === "all" ? "All" : t === "in" ? "Stock In" : "Stock Out"}
              </Button>
            ))}
          </div>
        </div>

        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-0 pt-4 px-4 border-b border-border">
            <div className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                Movement Log ({movements?.length ?? 0})
              </CardTitle>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Part
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    Unit Price
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    Reference
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    Note
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3">
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-10 ml-auto" />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-24 ml-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-8 w-20 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : movements && movements.length > 0 ? (
                  movements.map((movement) => (
                    <tr
                      key={movement.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold gap-1 ${
                            movement.type === "in"
                              ? "border-green-500/30 text-green-400 bg-green-500/10"
                              : "border-red-500/30 text-red-400 bg-red-500/10"
                          }`}
                        >
                          {movement.type === "in" ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {movement.type === "in" ? "In" : "Out"}
                        </Badge>
                      </td>

                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{movement.partName ?? "Unknown"}</p>
                          {movement.partCategory && (
                            <p className="text-xs text-muted-foreground">{movement.partCategory}</p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {movement.type === "in" ? "+" : "-"}
                        {movement.quantity}
                      </td>

                      <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground">
                        {movement.unitPrice ? `${Number(movement.unitPrice).toFixed(2)}` : "—"}
                      </td>

                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs font-mono">
                        {movement.reference || "—"}
                      </td>

                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs max-w-[200px] truncate">
                        {movement.note || "—"}
                      </td>

                      <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(movement.createdAt).toLocaleDateString()}
                        <br />
                        <span className="text-muted-foreground/60">
                          {new Date(movement.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                            onClick={() => openEditDialog(movement as MovementRow)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => {
                              setDeletingMovement(movement as MovementRow);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <RefreshCw className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No movements recorded</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Record your first stock movement to get started
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Edit Stock Movement" : "Record Stock Movement"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Movement Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setForm((prev) => ({ ...prev, type: "in" }))}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    form.type === "in"
                      ? "border-green-500/50 bg-green-500/10 text-green-400"
                      : "border-border text-muted-foreground hover:border-border/80"
                  }`}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Stock In
                </button>

                <button
                  onClick={() => setForm((prev) => ({ ...prev, type: "out" }))}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    form.type === "out"
                      ? "border-red-500/50 bg-red-500/10 text-red-400"
                      : "border-border text-muted-foreground hover:border-border/80"
                  }`}
                >
                  <ArrowDownRight className="h-4 w-4" />
                  Stock Out
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search Item</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                  placeholder="Search by name, SKU, or category..."
                  className="pl-9 bg-input border-border"
                />
                {partSearch && (
                  <button
                    onClick={() => setPartSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Part *</Label>
              <Select value={form.partId || "none"} onValueChange={handlePartChange}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Select a part..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>
                    Select a part...
                  </SelectItem>
                  {filteredParts.map((part) => (
                    <SelectItem key={part.id} value={part.id.toString()}>
                      {part.name} {part.sku ? `(${part.sku})` : ""} — Stock: {part.stock}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredParts.length === 0 && (
                <div className="text-xs text-muted-foreground px-1">No matching items</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Unit Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(e) => setForm((prev) => ({ ...prev, unitPrice: e.target.value }))}
                  placeholder="0.00"
                  className="bg-input border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reference / Invoice #</Label>
              <Input
                value={form.reference}
                onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
                placeholder="e.g. INV-2024-001"
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Note</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Optional notes..."
                className="bg-input border-border resize-none h-16"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingId(null);
                setPartSearch("");
                setForm(emptyForm);
              }}
              className="border-border"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={recordMutation.isPending || updateMutation.isPending}
              className={form.type === "in" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {editingId
                ? "Save Changes"
                : form.type === "in"
                  ? "Record Stock In"
                  : "Record Stock Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Stock Movement</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Delete this record for {deletingMovement?.partName || "this part"}? Current stock will
            be fixed automatically.
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingMovement(null);
              }}
              className="border-border"
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={() => deletingMovement && deleteMutation.mutate({ id: deletingMovement.id })}
              disabled={deleteMutation.isPending}
            >
              Delete Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}