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
  AlertTriangle,
  Edit2,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PartForm = {
  name: string;
  category: string;
  sku: string;
  price: string;
  stock: string;
  minStock: string;
  description: string;
  supplierId: string;
  imageUrl: string;
};

const emptyForm: PartForm = {
  name: "",
  category: "",
  sku: "",
  price: "",
  stock: "0",
  minStock: "5",
  description: "",
  supplierId: "",
  imageUrl: "",
};

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState<PartForm>(emptyForm);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const utils = trpc.useUtils();

  const { data: parts, isLoading } = trpc.parts.list.useQuery({
    search: search || undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    supplierId: supplierFilter !== "all" ? Number(supplierFilter) : undefined,
  });

  const { data: categories } = trpc.parts.categories.useQuery();
  const { data: suppliers } = trpc.suppliers.list.useQuery();

  const createMutation = trpc.parts.create.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const recordStockMutation = trpc.stock.record.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.parts.update.useMutation({
    onSuccess: () => {
      utils.parts.list.invalidate();
      utils.dashboard.summary.invalidate();
      toast.success("Part updated successfully");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.parts.delete.useMutation({
    onSuccess: () => {
      utils.parts.list.invalidate();
      utils.dashboard.summary.invalidate();
      toast.success("Part deleted");
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(part: NonNullable<typeof parts>[0]) {
    setEditingId(part.id);
    setForm({
      name: part.name,
      category: part.category ?? "",
      sku: part.sku ?? "",
      price: part.price?.toString() ?? "",
      stock: part.stock.toString(),
      minStock: part.minStock.toString(),
      description: part.description ?? "",
      supplierId: part.supplierId?.toString() ?? "",
      imageUrl: part.imageUrl ?? "",
    });
    setDialogOpen(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large (max 10MB)");
      return;
    }

    setIsUploading(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Failed to read image"));
          }
        };

        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          filename: file.name,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Upload failed");
      }

      const data = await response.json();

      if (!data?.url) {
        throw new Error("Upload succeeded but no image URL was returned");
      }

      setForm((prev) => ({ ...prev, imageUrl: data.url }));
      toast.success("Photo uploaded successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload photo");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      return toast.error("Part name is required");
    }

    if (!form.price || isNaN(Number(form.price))) {
      return toast.error("Valid price is required");
    }

    const openingQty = parseInt(form.stock, 10) || 0;

    const basePayload = {
      name: form.name.trim(),
      category: form.category || undefined,
      sku: form.sku || undefined,
      price: parseFloat(form.price).toFixed(2),
      minStock: parseInt(form.minStock, 10) || 5,
      description: form.description || undefined,
      supplierId: form.supplierId ? parseInt(form.supplierId, 10) : undefined,
      imageUrl: form.imageUrl || undefined,
    };

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        ...basePayload,
        stock: parseInt(form.stock, 10) || 0,
      });
      return;
    }

    try {
      const createdPart = await createMutation.mutateAsync({
        ...basePayload,
        stock: 0,
      });

      if (openingQty > 0 && createdPart?.id) {
        await recordStockMutation.mutateAsync({
          partId: createdPart.id,
          type: "in",
          quantity: openingQty,
          unitPrice: parseFloat(form.price).toFixed(2),
          reference: "Opening stock",
          note: "Created from Add Part form",
        });
      }

      utils.parts.list.invalidate();
      utils.stock.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.topSellers.invalidate();
      utils.dashboard.trends.invalidate();

      toast.success("Part added successfully");
      setDialogOpen(false);
      setForm(emptyForm);
    } catch (error) {
      console.error(error);
      toast.error("Failed to add part");
    }
  }

  const isLowStock = (stock: number, minStock: number) => stock <= minStock;

  return (
    <DashboardLayout>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Inventory</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your motorcycle parts catalog
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Part
          </Button>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or SKU..."
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

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-44 bg-input border-border">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-full sm:w-44 bg-input border-border">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-0 pt-4 px-4 border-b border-border">
            <div className="flex items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                Parts ({parts?.length ?? 0})
              </CardTitle>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Photo
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Part
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    SKU
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Price
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                    Supplier
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-12 ml-auto" />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-7 w-16 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : parts && parts.length > 0 ? (
                  parts.map((part) => {
                    const low = isLowStock(part.stock, part.minStock);

                    return (
                      <tr
                        key={part.id}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          {part.imageUrl ? (
                            <div
                              className="relative group cursor-pointer"
                              onClick={() => setPreviewImage(part.imageUrl)}
                            >
                              <img
                                src={part.imageUrl}
                                alt={part.name}
                                className="h-16 w-16 object-cover rounded-md border border-border"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                                <Search className="h-5 w-5 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="h-16 w-16 bg-muted rounded-md flex items-center justify-center border border-dashed border-border">
                              <span className="text-[10px] text-muted-foreground text-center px-1">
                                No Photo
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {low && (
                                <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
                              )}
                              <span className="font-bold text-lg text-foreground">
                                {part.name}
                              </span>
                            </div>

                            {part.imageUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-fit h-10 px-4 text-base font-semibold"
                                onClick={() => setPreviewImage(part.imageUrl)}
                              >
                                <Search className="h-5 w-5 mr-2" />
                                View Picture
                              </Button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 hidden sm:table-cell">
                          {part.category ? (
                            <Badge
                              variant="outline"
                              className="text-xs border-border text-muted-foreground"
                            >
                              {part.category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs font-mono">
                          {part.sku || "—"}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {Number(part.price).toFixed(2)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold ${
                              low
                                ? "border-orange-500/30 text-orange-400 bg-orange-500/10"
                                : "border-green-500/30 text-green-400 bg-green-500/10"
                            }`}
                          >
                            {part.stock}
                          </Badge>
                        </td>

                        <td className="px-4 py-3 hidden lg:table-cell text-sm text-muted-foreground">
                          {part.supplierName ?? "—"}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                              onClick={() => openEdit(part)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => {
                                setDeletingId(part.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No parts found</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {search || categoryFilter !== "all" || supplierFilter !== "all"
                          ? "Try adjusting your filters"
                          : "Add your first part to get started"}
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
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingId ? "Edit Part" : "Add New Part"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Part Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Brake Pad Set"
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Brakes"
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g. BP-001"
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Price *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Supplier</Label>
                <Select
                  value={form.supplierId || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, supplierId: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No supplier</SelectItem>
                    {suppliers?.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {editingId ? "Current Stock" : "Opening Stock"}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Min Stock Threshold</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                  className="bg-input border-border"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional notes about this part..."
                  className="bg-input border-border resize-none h-20"
                />
              </div>

              <div className="col-span-2 space-y-3 pt-2 border-t border-border">
                <Label className="text-base font-bold text-foreground">Product Photo</Label>

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  {form.imageUrl ? (
                    <div className="relative">
                      <img
                        src={form.imageUrl}
                        alt="Preview"
                        className="h-32 w-32 object-cover rounded-lg border-2 border-border"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-8 w-8 rounded-full shadow-lg"
                        onClick={() => setForm({ ...form, imageUrl: "" })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-32 w-32 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                      <Package className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <input
                      type="file"
                      id="photo-upload"
                      className="hidden"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />

                    <Button
                      asChild
                      variant="outline"
                      className="h-14 px-6 text-lg font-bold border-2 border-primary/50 hover:bg-primary/5"
                    >
                      <label
                        htmlFor="photo-upload"
                        className="cursor-pointer flex items-center gap-2"
                      >
                        {isUploading
                          ? "Uploading..."
                          : form.imageUrl
                            ? "Replace Picture"
                            : "Take Photo / Upload"}
                      </label>
                    </Button>

                    {form.imageUrl && (
                      <Button
                        variant="ghost"
                        className="h-12 text-base text-destructive font-semibold"
                        onClick={() => setForm({ ...form, imageUrl: "" })}
                      >
                        Delete Picture
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-14 px-8 text-lg font-bold border-border"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                recordStockMutation.isPending ||
                isUploading
              }
              className="h-14 px-8 text-lg font-bold"
            >
              {editingId ? "Save Changes" : "Add Part"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Part</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this part? This action cannot be undone.
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-border"
            >
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