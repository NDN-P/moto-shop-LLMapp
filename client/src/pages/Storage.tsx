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
import type { StorageItem } from "@shared/types";
import {
  ArrowRightLeft,
  Circle,
  Droplets,
  Edit2,
  Boxes,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type StorageKind = StorageItem["type"];

type StorageForm = {
  name: string;
  type: StorageKind;
  subcategory: string;
  brand: string;
  variant: string;
  sizeLabel: string;
  patternLabel: string;
  containerCount: string;
  unitsPerContainer: string;
  looseUnits: string;
  notes: string;
};

type TransferForm = {
  storageItemId: number | null;
  partId: string;
  quantity: string;
  note: string;
};

type StorageRow = {
  id: number;
  name: string;
  type: StorageKind;
  subcategory?: string | null;
  brand?: string | null;
  variant?: string | null;
  sizeLabel?: string | null;
  patternLabel?: string | null;
  containerCount: number;
  unitsPerContainer: number;
  looseUnits: number;
  totalUnits: number;
  notes?: string | null;
};

const emptyForm: StorageForm = {
  name: "",
  type: "oil",
  subcategory: "",
  brand: "",
  variant: "",
  sizeLabel: "",
  patternLabel: "",
  containerCount: "0",
  unitsPerContainer: "0",
  looseUnits: "0",
  notes: "",
};

const emptyTransferForm: TransferForm = {
  storageItemId: null,
  partId: "",
  quantity: "1",
  note: "",
};

export default function Storage() {
  const [search, setSearch] = useState("");
  const [oilBrandFilter, setOilBrandFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<StorageForm>(emptyForm);
  const [transferForm, setTransferForm] = useState<TransferForm>(emptyTransferForm);
  const [inventorySearch, setInventorySearch] = useState("");

  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.storage.list.useQuery();
  const { data: parts } = trpc.parts.list.useQuery({});

  const createMutation = trpc.storage.create.useMutation({
    onSuccess: () => {
      utils.storage.list.invalidate();
      toast.success("Storage item added");
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.storage.update.useMutation({
    onSuccess: () => {
      utils.storage.list.invalidate();
      toast.success("Storage item updated");
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.storage.delete.useMutation({
    onSuccess: () => {
      utils.storage.list.invalidate();
      toast.success("Storage item deleted");
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const transferMutation = trpc.storage.transferToInventory.useMutation({
    onSuccess: () => {
      utils.storage.list.invalidate();
      utils.parts.list.invalidate();
      utils.stock.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.topSellers.invalidate();
      utils.dashboard.trends.invalidate();
      toast.success("Moved to front shop inventory");
      setTransferDialogOpen(false);
      setTransferForm(emptyTransferForm);
      setInventorySearch("");
    },
    onError: (e) => toast.error(e.message),
  });

  const allRows = (items ?? []).filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.subcategory?.toLowerCase().includes(q) ||
      item.brand?.toLowerCase().includes(q) ||
      item.variant?.toLowerCase().includes(q) ||
      item.sizeLabel?.toLowerCase().includes(q) ||
      item.patternLabel?.toLowerCase().includes(q) ||
      item.notes?.toLowerCase().includes(q)
    );
  });

  const oilBrands = useMemo(() => {
    return Array.from(
      new Set(
        allRows
          .filter((item) => item.type === "oil")
          .map((item) => item.brand?.trim())
          .filter(Boolean) as string[]
      )
    ).sort();
  }, [allRows]);

  const oilRows = allRows.filter((item) => {
    if (item.type !== "oil") return false;
    if (oilBrandFilter === "all") return true;
    return item.brand === oilBrandFilter;
  });
  const tireRows = allRows.filter((item) => item.type === "tire");
  const tubeRows = allRows.filter((item) => item.type === "tube");
  const otherRows = allRows.filter((item) => item.type === "other");

  const filteredInventoryParts = (parts ?? []).filter((part) => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return true;
    return (
      part.name.toLowerCase().includes(q) ||
      part.sku?.toLowerCase().includes(q) ||
      part.category?.toLowerCase().includes(q)
    );
  });

  const selectedTransferItem =
    allRows.find((item) => item.id === transferForm.storageItemId) ?? null;

  function openAdd(type?: StorageKind) {
    setEditingId(null);
    setForm(type ? { ...emptyForm, type } : emptyForm);
    setDialogOpen(true);
  }

  function openEdit(item: StorageRow) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      type: item.type,
      subcategory: item.subcategory ?? "",
      brand: item.brand ?? "",
      variant: item.variant ?? "",
      sizeLabel: item.sizeLabel ?? "",
      patternLabel: item.patternLabel ?? "",
      containerCount: item.containerCount.toString(),
      unitsPerContainer: item.unitsPerContainer.toString(),
      looseUnits: item.looseUnits.toString(),
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  }

  function openTransfer(item: StorageRow) {
    setTransferForm({
      storageItemId: item.id,
      partId: "",
      quantity: "1",
      note: "",
    });
    setInventorySearch("");
    setTransferDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) return toast.error("Name is required");

    const payload = {
      name: form.name.trim(),
      type: form.type,
      subcategory: form.type === "other" ? form.subcategory.trim() || undefined : undefined,
      brand: form.type === "tire" ? undefined : form.brand || undefined,
      variant: form.variant || undefined,
      sizeLabel: form.sizeLabel || undefined,
      patternLabel: form.patternLabel || undefined,
      containerCount: parseInt(form.containerCount, 10) || 0,
      unitsPerContainer: parseInt(form.unitsPerContainer, 10) || 0,
      looseUnits: parseInt(form.looseUnits, 10) || 0,
      notes: form.notes || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleTransfer() {
    if (!transferForm.storageItemId) return toast.error("Storage item is required");
    if (!transferForm.partId) return toast.error("Please choose the inventory item");
    const qty = parseInt(transferForm.quantity, 10) || 0;
    if (qty < 1) return toast.error("Quantity must be at least 1");
    if (selectedTransferItem && qty > selectedTransferItem.totalUnits) {
      return toast.error("Not enough stock in storage");
    }

    transferMutation.mutate({
      storageItemId: transferForm.storageItemId,
      partId: parseInt(transferForm.partId, 10),
      quantity: qty,
      note: transferForm.note || undefined,
    });
  }

  function getTypeIcon(type: StorageKind) {
    switch (type) {
      case "oil":
        return <Droplets className="h-4 w-4 text-blue-400" />;
      case "tire":
        return <Circle className="h-4 w-4 text-gray-300" />;
      case "tube":
        return <Package className="h-4 w-4 text-orange-400" />;
      case "other":
        return <Boxes className="h-4 w-4 text-emerald-400" />;
    }
  }

  function getTypeLabel(type: StorageKind) {
    switch (type) {
      case "oil":
        return "น้ำมันเครื่อง";
      case "tire":
        return "ยางนอก";
      case "tube":
        return "ยางใน";
      case "other":
        return "อื่นๆ";
    }
  }

  function getContainerWord(type: StorageKind) {
    switch (type) {
      case "oil":
        return "ลัง";
      case "tire":
        return "มัด";
      case "tube":
        return "กระสอบ";
      case "other":
        return "ชิ้น";
    }
  }

  function getLooseWord(type: StorageKind) {
    switch (type) {
      case "oil":
        return "ขวด";
      case "tire":
        return "ชิ้น";
      case "tube":
        return "ชิ้น";
      case "other":
        return "ชิ้น";
    }
  }

  function getUnitsPerContainerLabel(type: StorageKind) {
    switch (type) {
      case "oil":
        return "ขวดต่อลัง";
      case "tire":
        return "ชิ้นต่อมัด";
      case "tube":
        return "ชิ้นต่อกระสอบ";
      case "other":
        return "ชิ้นต่อลัง";
    }
  }

  function renderRow(item: StorageRow) {
    return (
      <div
        key={item.id}
        className="flex flex-col gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs gap-1 border-border text-foreground">
                {getTypeIcon(item.type)}
                {getTypeLabel(item.type)}
              </Badge>
              {item.brand && (
                <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                  {item.brand}
                </Badge>
              )}
              {item.subcategory && (
                <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
                  {item.subcategory}
                </Badge>
              )}
            </div>
            <p className="font-medium text-foreground mt-1 truncate">{item.name}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {item.variant && <span>{item.variant}</span>}
              {item.sizeLabel && <span>Size {item.sizeLabel}</span>}
              {item.patternLabel && <span>{item.patternLabel}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
              onClick={() => openEdit(item)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setDeletingId(item.id);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {(item.type !== "other" || item.containerCount > 0 || item.unitsPerContainer > 0) && (
            <Badge variant="outline" className="border-border text-foreground bg-muted/20">
              {item.containerCount} {getContainerWord(item.type)}
            </Badge>
          )}
          <Badge variant="outline" className="border-border text-foreground bg-muted/20">
            {item.type === "other" ? "Loose " : ""}
            {item.looseUnits} {getLooseWord(item.type)}
          </Badge>
          {(item.type !== "other" || item.containerCount > 0 || item.unitsPerContainer > 0) && (
            <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 bg-cyan-500/10">
              {item.unitsPerContainer} {getUnitsPerContainerLabel(item.type)}
            </Badge>
          )}
          <Badge variant="outline" className="border-violet-500/30 text-violet-300 bg-violet-500/10">
            Total {item.totalUnits} {getLooseWord(item.type)}
          </Badge>
        </div>

        {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}

        <div className="flex justify-end">
          <Button variant="outline" className="gap-2" onClick={() => openTransfer(item)}>
            <ArrowRightLeft className="h-4 w-4" />
            Move to Shop
          </Button>
        </div>
      </div>
    );
  }

  function renderSection(title: string, rows: StorageRow[], type: StorageKind) {
    return (
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-0 pt-4 px-4 border-b border-border">
          <div className="flex items-center justify-between pb-3 gap-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              {getTypeIcon(type)}
              {title} ({rows.length})
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => openAdd(type)}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {type === "oil" && oilBrands.length > 0 && (
            <div className="flex gap-2 flex-wrap pb-3">
              <Button
                size="sm"
                variant={oilBrandFilter === "all" ? "default" : "outline"}
                onClick={() => setOilBrandFilter("all")}
                className={`h-8 ${oilBrandFilter !== "all" ? "border-border text-muted-foreground" : ""}`}
              >
                All
              </Button>
              {oilBrands.map((brand) => (
                <Button
                  key={brand}
                  size="sm"
                  variant={oilBrandFilter === brand ? "default" : "outline"}
                  onClick={() => setOilBrandFilter(brand)}
                  className={`h-8 ${oilBrandFilter !== brand ? "border-border text-muted-foreground" : ""}`}
                >
                  {brand}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              ))}
            </div>
          ) : rows.length > 0 ? (
            <div>{rows.map(renderRow)}</div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No {title.toLowerCase()} items
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full max-w-none">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Storage</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Bulk deliveries for oil, tires, inner tubes, and other shop stock
            </p>
          </div>
          <Button onClick={() => openAdd()} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Storage Item
          </Button>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search storage..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-input border-border"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-4 gap-4">
          {renderSection("น้ำมันเครื่อง", oilRows, "oil")}
          {renderSection("ยางนอก", tireRows, "tire")}
          {renderSection("ยางใน", tubeRows, "tube")}
          {renderSection("อื่นๆ", otherRows, "other")}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Edit Storage Item" : "Add Storage Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Item Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-input border-border"
                  placeholder={
                    form.type === "oil"
                      ? "e.g. 4T Max"
                      : form.type === "tire"
                        ? "e.g. Tire Outside"
                        : form.type === "tube"
                          ? "e.g. Tube"
                          : "e.g. brake pads, battery"
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={form.type} onValueChange={(v: StorageKind) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oil">น้ำมันเครื่อง</SelectItem>
                    <SelectItem value="tire">ยางนอก</SelectItem>
                    <SelectItem value="tube">ยางใน</SelectItem>
                    <SelectItem value="other">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.type === "other" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Subcategory</Label>
                  <Input
                    value={form.subcategory}
                    onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                    className="bg-input border-border"
                    placeholder="brake pads, battery, chain, bulb"
                  />
                </div>
              )}

              {form.type !== "tire" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {form.type === "tube" ? "Brand / Variant" : "Brand"}
                  </Label>
                  <Input
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="bg-input border-border"
                    placeholder={form.type === "oil" ? "e.g. PTT / Bangchak" : "Brand / variant"}
                  />
                </div>
              )}

              {form.type === "oil" && (
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Variant / Size</Label>
                  <Input
                    value={form.variant}
                    onChange={(e) => setForm({ ...form, variant: e.target.value })}
                    className="bg-input border-border"
                    placeholder="e.g. 0.8L / 1L / 2T"
                  />
                </div>
              )}

              {form.type === "tire" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tire Number / Size</Label>
                    <Input
                      value={form.sizeLabel}
                      onChange={(e) => setForm({ ...form, sizeLabel: e.target.value })}
                      className="bg-input border-border"
                      placeholder="e.g. 70/90-17"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Pattern / Type</Label>
                    <Input
                      value={form.patternLabel}
                      onChange={(e) => setForm({ ...form, patternLabel: e.target.value })}
                      className="bg-input border-border"
                      placeholder="e.g. Bluehorse"
                    />
                  </div>
                </>
              )}

              {form.type === "tube" && (
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tube Size / Variant</Label>
                  <Input
                    value={form.variant}
                    onChange={(e) => setForm({ ...form, variant: e.target.value })}
                    className="bg-input border-border"
                    placeholder="e.g. 70/90-17"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{getContainerWord(form.type)}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.containerCount}
                  onChange={(e) => setForm({ ...form, containerCount: e.target.value })}
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{getUnitsPerContainerLabel(form.type)}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.unitsPerContainer}
                  onChange={(e) => setForm({ ...form, unitsPerContainer: e.target.value })}
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Loose {getLooseWord(form.type)}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.looseUnits}
                  onChange={(e) => setForm({ ...form, looseUnits: e.target.value })}
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Total {getLooseWord(form.type)}</Label>
                <div className="h-10 rounded-md border border-border bg-muted/20 px-3 flex items-center font-semibold text-foreground">
                  {(parseInt(form.containerCount, 10) || 0) * (parseInt(form.unitsPerContainer, 10) || 0) +
                    (parseInt(form.looseUnits, 10) || 0)}
                </div>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="bg-input border-border resize-none h-20"
                  placeholder="Optional notes..."
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "Save Changes" : "Save Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Move to Shop Inventory</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {selectedTransferItem && (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="font-medium text-foreground">{selectedTransferItem.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Available: {selectedTransferItem.totalUnits} {getLooseWord(selectedTransferItem.type)}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search Inventory Item</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="Search by name, SKU, or category..."
                  className="pl-9 bg-input border-border"
                />
                {inventorySearch && (
                  <button
                    onClick={() => setInventorySearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Inventory Item *</Label>
              <Select
                value={transferForm.partId || "none"}
                onValueChange={(v) =>
                  setTransferForm((prev) => ({ ...prev, partId: v === "none" ? "" : v }))
                }
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Choose inventory item..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>
                    Choose inventory item...
                  </SelectItem>
                  {filteredInventoryParts.map((part) => (
                    <SelectItem key={part.id} value={part.id.toString()}>
                      {part.name} {part.sku ? `(${part.sku})` : ""} - Stock: {part.stock}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredInventoryParts.length === 0 && (
                <div className="text-xs text-muted-foreground px-1">No matching inventory items</div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quantity *</Label>
              <Input
                type="number"
                min="1"
                value={transferForm.quantity}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, quantity: e.target.value }))}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Note</Label>
              <Textarea
                value={transferForm.note}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, note: e.target.value }))}
                className="bg-input border-border resize-none h-20"
                placeholder="Defaults to Transferred from storage"
              />
            </div>
          </div>
          <DialogFooter className="gap-3 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setTransferDialogOpen(false);
                setTransferForm(emptyTransferForm);
              }}
              className="border-border"
            >
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={transferMutation.isPending} className="gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Move to Shop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Storage Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this storage item?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="border-border">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMutation.mutate({ id: deletingId })}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
