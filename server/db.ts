import fs from "node:fs";
import path from "node:path";
import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import {
  InsertPart,
  InsertStorageItem,
  InsertSupplier,
  InsertUser,
  parts,
  stockMovements,
  storageItems,
  suppliers,
  users,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;

function normalizeDatabasePath(url: string | undefined) {
  if (!url) return "./moto-shop.db";
  return url.replace(/^file:/, "");
}

const DEFAULT_TS_SQL = "(CAST(strftime('%s','now') AS INTEGER) * 1000)";

function columnExists(sqlite: Database.Database, tableName: string, columnName: string) {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function ensureColumn(sqlite: Database.Database, tableName: string, columnName: string, sqlType: string) {
  if (!columnExists(sqlite, tableName, columnName)) {
    sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType}`);
  }
}

function initializeDatabase(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      loginMethod TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt INTEGER NOT NULL DEFAULT ${DEFAULT_TS_SQL},
      updatedAt INTEGER NOT NULL DEFAULT ${DEFAULT_TS_SQL},
      lastSignedIn INTEGER NOT NULL DEFAULT ${DEFAULT_TS_SQL}
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contactName TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      createdAt INTEGER NOT NULL DEFAULT ${DEFAULT_TS_SQL},
      updatedAt INTEGER NOT NULL DEFAULT ${DEFAULT_TS_SQL}
    );

    CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT,
      category TEXT,
      price TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      minStock INTEGER NOT NULL DEFAULT 5,
      description TEXT,
      supplierId INTEGER,
      isActive INTEGER NOT NULL DEFAULT 1,
      imageUrl TEXT,
      createdAt INTEGER NOT NULL DEFAULT ${DEFAULT_TS_SQL},
      updatedAt INTEGER NOT NULL DEFAULT ${DEFAULT_TS_SQL}
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partId INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unitPrice TEXT,
      reference TEXT,
      note TEXT,
      createdAt INTEGER NOT NULL DEFAULT ${DEFAULT_TS_SQL}
    );

    CREATE TABLE IF NOT EXISTS storage_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      subcategory TEXT,
      containerCount INTEGER NOT NULL DEFAULT 0,
      unitsPerContainer INTEGER NOT NULL DEFAULT 0,
      totalUnits INTEGER NOT NULL DEFAULT 0,
      label TEXT,
      notes TEXT,
      updatedAt INTEGER NOT NULL DEFAULT ${DEFAULT_TS_SQL}
    );
  `);

  ensureColumn(sqlite, "parts", "imageUrl", "TEXT");

  ensureColumn(sqlite, "storage_items", "subcategory", "TEXT");
  ensureColumn(sqlite, "storage_items", "brand", "TEXT");
  ensureColumn(sqlite, "storage_items", "variant", "TEXT");
  ensureColumn(sqlite, "storage_items", "sizeLabel", "TEXT");
  ensureColumn(sqlite, "storage_items", "patternLabel", "TEXT");
  ensureColumn(sqlite, "storage_items", "looseUnits", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(sqlite, "storage_items", "label", "TEXT");
  ensureColumn(sqlite, "storage_items", "notes", "TEXT");
  ensureColumn(sqlite, "storage_items", "updatedAt", `INTEGER NOT NULL DEFAULT ${DEFAULT_TS_SQL}`);

  if (columnExists(sqlite, "storage_items", "label") && !columnExists(sqlite, "storage_items", "sizeLabel")) {
    sqlite.exec(`UPDATE storage_items SET sizeLabel = label WHERE sizeLabel IS NULL AND label IS NOT NULL`);
  }

  if (columnExists(sqlite, "storage_items", "totalUnits") && columnExists(sqlite, "storage_items", "containerCount") && columnExists(sqlite, "storage_items", "unitsPerContainer") && columnExists(sqlite, "storage_items", "looseUnits")) {
    sqlite.exec(`
      UPDATE storage_items
      SET totalUnits = CASE
        WHEN totalUnits IS NULL OR totalUnits = 0 THEN (containerCount * unitsPerContainer) + looseUnits
        ELSE totalUnits
      END
    `);
  }
}

function computeStorageTotals(containerCount: number, unitsPerContainer: number, looseUnits: number) {
  const safeContainers = Math.max(0, containerCount || 0);
  const safeUnitsPerContainer = Math.max(0, unitsPerContainer || 0);
  const safeLoose = Math.max(0, looseUnits || 0);
  const totalUnits = safeContainers * safeUnitsPerContainer + safeLoose;
  return {
    containerCount: safeContainers,
    unitsPerContainer: safeUnitsPerContainer,
    looseUnits: safeLoose,
    totalUnits,
  };
}

function rebalanceStorageFromTotal(totalUnits: number, unitsPerContainer: number) {
  const safeTotal = Math.max(0, totalUnits || 0);
  const safeUnitsPerContainer = Math.max(0, unitsPerContainer || 0);
  if (safeUnitsPerContainer <= 0) {
    return { containerCount: 0, looseUnits: safeTotal, totalUnits: safeTotal };
  }
  return {
    containerCount: Math.floor(safeTotal / safeUnitsPerContainer),
    looseUnits: safeTotal % safeUnitsPerContainer,
    totalUnits: safeTotal,
  };
}

export async function getDb() {
  if (!_db || !_sqlite) {
    const dbPath = normalizeDatabasePath(process.env.DATABASE_URL);
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    initializeDatabase(sqlite);
    _sqlite = sqlite;
    _db = drizzle(sqlite);
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();

  const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
  if (existing.length > 0) {
    await db.update(users).set(updateSet).where(eq(users.openId, user.openId));
  } else {
    await db.insert(users).values({ ...values, createdAt: new Date(), updatedAt: new Date() });
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listSuppliers() {
  const db = await getDb();
  return db.select().from(suppliers).orderBy(suppliers.name);
}

export async function getSupplierById(id: number) {
  const db = await getDb();
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createSupplier(input: {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}) {
  const db = await getDb();
  const result = await db.insert(suppliers).values(input).returning();
  return result[0];
}

export async function updateSupplier(id: number, data: Partial<InsertSupplier>) {
  const db = await getDb();
  const result = await db
    .update(suppliers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(suppliers.id, id))
    .returning();
  return result[0];
}

export async function deleteSupplier(id: number) {
  const db = await getDb();
  db.transaction((tx) => {
    tx.update(parts).set({ supplierId: null, updatedAt: new Date() }).where(eq(parts.supplierId, id)).run();
    tx.delete(suppliers).where(eq(suppliers.id, id)).run();
  }, { behavior: "immediate" });
  return { success: true };
}

export async function listParts(filters?: {
  search?: string;
  category?: string;
  supplierId?: number;
  lowStock?: boolean;
}) {
  const db = await getDb();
  const conditions: any[] = [];

  if (filters?.search) {
    conditions.push(or(like(parts.name, `%${filters.search}%`), like(parts.sku, `%${filters.search}%`)));
  }
  if (filters?.category) {
    conditions.push(eq(parts.category, filters.category));
  }
  if (filters?.supplierId) {
    conditions.push(eq(parts.supplierId, filters.supplierId));
  }
  if (filters?.lowStock) {
    conditions.push(lte(parts.stock, parts.minStock));
  }

  let query: any = db.select().from(parts);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rows = await query.orderBy(parts.name);
  const supplierRows = await db.select().from(suppliers);
  const supplierMap = new Map(supplierRows.map((supplier) => [supplier.id, supplier.name]));

  return rows.map((part) => ({
    ...part,
    supplierName: part.supplierId ? supplierMap.get(part.supplierId) ?? null : null,
  }));
}

export async function getPartById(id: number) {
  const db = await getDb();
  const result = await db.select().from(parts).where(eq(parts.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getCategories() {
  const db = await getDb();
  const allParts = await db.select().from(parts);
  const categorySet = new Set<string>();
  for (const part of allParts) {
    if (part.category) categorySet.add(part.category);
  }
  return Array.from(categorySet).sort();
}

export async function createPart(input: {
  name: string;
  category?: string;
  sku?: string;
  price: string;
  stock?: number;
  minStock?: number;
  description?: string;
  supplierId?: number;
  imageUrl?: string;
}) {
  validateMoney(input.price);
  if (input.stock !== undefined) validateStockCount(input.stock);
  if (input.minStock !== undefined) validateStockCount(input.minStock);
  const db = await getDb();
  return db.transaction((tx) => {
    if (input.supplierId != null && !tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).get()) {
      throw new Error("Supplier not found");
    }
    return tx.insert(parts).values(input).returning().get();
  }, { behavior: "immediate" });
}

export async function updatePart(id: number, data: Partial<InsertPart>) {
  if (data.price !== undefined) validateMoney(data.price);
  if (data.stock !== undefined) validateStockCount(data.stock);
  if (data.minStock !== undefined) validateStockCount(data.minStock);
  const db = await getDb();
  return db.transaction((tx) => {
    if (data.supplierId != null && !tx.select().from(suppliers).where(eq(suppliers.id, data.supplierId)).get()) {
      throw new Error("Supplier not found");
    }
    return tx.update(parts).set({ ...data, updatedAt: new Date() }).where(eq(parts.id, id)).returning().get();
  }, { behavior: "immediate" });
}

export async function deletePart(id: number) {
  const db = await getDb();
  const imageUrl = db.transaction((tx) => {
    const part = tx.select().from(parts).where(eq(parts.id, id)).get();
    if (!part) return null;
    if (tx.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.partId, id)).get()) {
      throw new Error("Cannot delete a product with stock movement history");
    }
    tx.delete(parts).where(eq(parts.id, id)).run();
    const imageInUse = part.imageUrl && tx.select({ id: parts.id }).from(parts).where(eq(parts.imageUrl, part.imageUrl)).get();
    return imageInUse ? null : part.imageUrl;
  }, { behavior: "immediate" });

  if (imageUrl && /^\/uploads\/products\/[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(imageUrl)) {
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    const imageDir = path.join(uploadsDir, "products");
    const filePath = path.join(imageDir, path.basename(imageUrl));
    try {
      if (!fs.lstatSync(uploadsDir).isSymbolicLink() && !fs.lstatSync(imageDir).isSymbolicLink()
          && fs.lstatSync(filePath).isFile() && path.dirname(fs.realpathSync(filePath)) === fs.realpathSync(imageDir)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to delete image file:", e);
      }
    }
  }
  return { success: true };
}

export async function listStockMovements(filters?: {
  partId?: number;
  type?: "in" | "out";
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const db = await getDb();
  const conditions: any[] = [];

  if (filters?.partId) {
    conditions.push(eq(stockMovements.partId, filters.partId));
  }
  if (filters?.type) {
    conditions.push(eq(stockMovements.type, filters.type));
  }
  if (filters?.from) {
    conditions.push(gte(stockMovements.createdAt, filters.from));
  }
  if (filters?.to) {
    conditions.push(lte(stockMovements.createdAt, filters.to));
  }

  let query: any = db.select().from(stockMovements);
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  query = query.orderBy(desc(stockMovements.createdAt));

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const rows = await query;
  const partRows = await db.select().from(parts);
  const partMap = new Map(partRows.map((part) => [part.id, part]));

  return rows.map((movement) => {
    const part = partMap.get(movement.partId);
    return {
      ...movement,
      partName: part?.name ?? null,
      partCategory: part?.category ?? null,
    };
  });
}

function validateMoney(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value))) {
    throw new Error("Price must be a finite nonnegative decimal with at most two fractional digits");
  }
}

function validateStockCount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Stock must be a nonnegative safe integer");
}

function movementEffect(type: "in" | "out", quantity: number) {
  validateStockCount(quantity);
  if (quantity === 0) throw new Error("Quantity must be at least 1");
  return type === "in" ? quantity : -quantity;
}

export async function recordStockMovement(input: {
  partId: number;
  type: "in" | "out";
  quantity: number;
  note?: string;
  reference?: string;
  unitPrice?: string;
}) {
  const effect = movementEffect(input.type, input.quantity);
  if (input.unitPrice !== undefined) validateMoney(input.unitPrice);
  const db = await getDb();
  return db.transaction((tx) => {
    const part = tx.select().from(parts).where(eq(parts.id, input.partId)).get();
    if (!part) throw new Error("Part not found");
    const newStock = part.stock + effect;
    if (newStock < 0) throw new Error("Insufficient stock");
    validateStockCount(newStock);
    tx.update(parts).set({ stock: newStock, updatedAt: new Date() }).where(eq(parts.id, part.id)).run();
    return tx.insert(stockMovements).values(input).returning().get();
  }, { behavior: "immediate" });
}

export async function updateStockMovement(
  id: number,
  input: {
    partId: number;
    type: "in" | "out";
    quantity: number;
    note?: string;
    reference?: string;
    unitPrice?: string;
  }
) {
  const newEffect = movementEffect(input.type, input.quantity);
  if (input.unitPrice !== undefined) validateMoney(input.unitPrice);
  const db = await getDb();
  return db.transaction((tx) => {
    const old = tx.select().from(stockMovements).where(eq(stockMovements.id, id)).get();
    if (!old) throw new Error("Stock movement not found");
    const oldPart = tx.select().from(parts).where(eq(parts.id, old.partId)).get();
    const newPart = tx.select().from(parts).where(eq(parts.id, input.partId)).get();
    if (!oldPart || !newPart) throw new Error("Part not found");
    const oldEffect = movementEffect(old.type, old.quantity);

    if (old.partId === input.partId) {
      const adjustedStock = oldPart.stock - oldEffect + newEffect;
      if (adjustedStock < 0) throw new Error("Insufficient stock after update");
      validateStockCount(adjustedStock);
      tx.update(parts).set({ stock: adjustedStock, updatedAt: new Date() }).where(eq(parts.id, oldPart.id)).run();
    } else {
      const revertedOldStock = oldPart.stock - oldEffect;
      const adjustedNewStock = newPart.stock + newEffect;
      if (revertedOldStock < 0) throw new Error("Cannot remove stock from old item");
      if (adjustedNewStock < 0) throw new Error("Insufficient stock for new item");
      validateStockCount(revertedOldStock);
      validateStockCount(adjustedNewStock);
      tx.update(parts).set({ stock: revertedOldStock, updatedAt: new Date() }).where(eq(parts.id, oldPart.id)).run();
      tx.update(parts).set({ stock: adjustedNewStock, updatedAt: new Date() }).where(eq(parts.id, newPart.id)).run();
    }

    return tx.update(stockMovements).set(input).where(eq(stockMovements.id, id)).returning().get();
  }, { behavior: "immediate" });
}

export async function deleteStockMovement(id: number) {
  const db = await getDb();
  db.transaction((tx) => {
    const movement = tx.select().from(stockMovements).where(eq(stockMovements.id, id)).get();
    if (!movement) throw new Error("Stock movement not found");
    const part = tx.select().from(parts).where(eq(parts.id, movement.partId)).get();
    if (!part) throw new Error("Part not found");
    const adjustedStock = part.stock - movementEffect(movement.type, movement.quantity);
    if (adjustedStock < 0) throw new Error("Cannot delete this movement because stock would become negative");
    validateStockCount(adjustedStock);
    tx.update(parts).set({ stock: adjustedStock, updatedAt: new Date() }).where(eq(parts.id, part.id)).run();
    tx.delete(stockMovements).where(eq(stockMovements.id, id)).run();
  }, { behavior: "immediate" });
  return { success: true };
}

export async function getDashboardSummary() {
  const db = await getDb();
  const allParts = await db.select().from(parts);
  const lowStockParts = allParts.filter((part) => part.stock <= part.minStock);
  const allSuppliers = await db.select().from(suppliers);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMovements = await db
    .select()
    .from(stockMovements)
    .where(gte(stockMovements.createdAt, today));

  return {
    totalParts: allParts.length,
    lowStockCount: lowStockParts.length,
    totalSuppliers: allSuppliers.length,
    totalMovementsToday: todayMovements.length,
  };
}

export async function getTopSellers(limit: number = 5) {
  const db = await getDb();
  const movementSummary = await db
    .select({
      partId: stockMovements.partId,
      totalQty: sql<number>`SUM(CASE WHEN ${stockMovements.type} = 'out' THEN ${stockMovements.quantity} ELSE 0 END)`,
    })
    .from(stockMovements)
    .groupBy(stockMovements.partId)
    .orderBy(desc(sql<number>`SUM(CASE WHEN ${stockMovements.type} = 'out' THEN ${stockMovements.quantity} ELSE 0 END)`))
    .limit(limit);

  const result: Array<{ partId: number; partName: string; partCategory: string | null; totalOut: number }> = [];
  for (const row of movementSummary) {
    const part = await getPartById(row.partId);
    if (part) {
      result.push({
        partId: part.id,
        partName: part.name,
        partCategory: part.category,
        totalOut: row.totalQty || 0,
      });
    }
  }

  return result;
}

export async function getTrends(period: "day" | "week" | "month") {
  const db = await getDb();
  const now = new Date();
  const startDate = new Date();

  if (period === "day") {
    startDate.setDate(now.getDate() - 30);
  } else if (period === "week") {
    startDate.setDate(now.getDate() - 90);
  } else {
    startDate.setMonth(now.getMonth() - 12);
  }

  const movements = await db
    .select()
    .from(stockMovements)
    .where(gte(stockMovements.createdAt, startDate))
    .orderBy(stockMovements.createdAt);

  const grouped: Record<string, { in: number; out: number; revenue: number }> = {};

  for (const movement of movements) {
    const date = new Date(movement.createdAt);
    let bucket: string;

    if (period === "day") {
      bucket = date.toISOString().split("T")[0]!;
    } else if (period === "week") {
      const firstDay = new Date(date.getFullYear(), 0, 1);
      const dayOfYear = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
      const week = String(Math.floor(dayOfYear / 7) + 1).padStart(2, "0");
      bucket = `${date.getFullYear()}-${week}`;
    } else {
      bucket = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    if (!grouped[bucket]) {
      grouped[bucket] = { in: 0, out: 0, revenue: 0 };
    }

    if (movement.type === "in") {
      grouped[bucket].in += movement.quantity;
    } else {
      grouped[bucket].out += movement.quantity;
      if (movement.unitPrice) {
        grouped[bucket].revenue += movement.quantity * parseFloat(movement.unitPrice);
      }
    }
  }

  return Object.entries(grouped)
    .flatMap(([bucket, data]) => [
      { period: bucket, type: "in" as const, total: data.in, revenue: 0 },
      { period: bucket, type: "out" as const, total: data.out, revenue: data.revenue },
    ])
    .sort((a, b) => a.period.localeCompare(b.period));
}

export async function listStorageItems() {
  const db = await getDb();
  return db.select().from(storageItems).orderBy(storageItems.type, storageItems.subcategory, storageItems.brand, storageItems.name, storageItems.variant);
}

export async function getStorageItemById(id: number) {
  const db = await getDb();
  const rows = await db.select().from(storageItems).where(eq(storageItems.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createStorageItem(input: {
  name: string;
  type: "oil" | "tire" | "tube" | "other";
  subcategory?: string;
  brand?: string;
  variant?: string;
  sizeLabel?: string;
  patternLabel?: string;
  containerCount: number;
  unitsPerContainer: number;
  looseUnits?: number;
  notes?: string;
}) {
  const db = await getDb();
  const totals = computeStorageTotals(input.containerCount, input.unitsPerContainer, input.looseUnits ?? 0);
  const result = await db
    .insert(storageItems)
    .values({ ...input, ...totals, updatedAt: new Date() } as InsertStorageItem)
    .returning();
  return result[0];
}

export async function updateStorageItem(id: number, data: Partial<InsertStorageItem>) {
  const db = await getDb();
  const existing = await getStorageItemById(id);
  if (!existing) throw new Error("Storage item not found");

  const containerCount = data.containerCount ?? existing.containerCount;
  const unitsPerContainer = data.unitsPerContainer ?? existing.unitsPerContainer;
  const looseUnits = data.looseUnits ?? existing.looseUnits;
  const totals = computeStorageTotals(containerCount, unitsPerContainer, looseUnits);

  const result = await db
    .update(storageItems)
    .set({ ...data, ...totals, updatedAt: new Date() })
    .where(eq(storageItems.id, id))
    .returning();
  return result[0];
}

export async function deleteStorageItem(id: number) {
  const db = await getDb();
  await db.delete(storageItems).where(eq(storageItems.id, id));
  return { success: true };
}

export async function transferStorageToInventory(input: {
  storageItemId: number;
  partId: number;
  quantity: number;
  note?: string;
}) {
  validateStockCount(input.quantity);
  if (input.quantity === 0) throw new Error("Quantity must be at least 1");
  const db = await getDb();
  return db.transaction((tx) => {
    const storageItem = tx.select().from(storageItems).where(eq(storageItems.id, input.storageItemId)).get();
    if (!storageItem) throw new Error("Storage item not found");
    if (input.quantity > storageItem.totalUnits) throw new Error("Not enough stock in storage");
    const part = tx.select().from(parts).where(eq(parts.id, input.partId)).get();
    if (!part) throw new Error("Inventory item not found");
    const newStock = part.stock + input.quantity;
    validateStockCount(newStock);
    const balanced = rebalanceStorageFromTotal(storageItem.totalUnits - input.quantity, storageItem.unitsPerContainer);
    const referenceBits = [
      "Transferred from storage", storageItem.subcategory, storageItem.brand,
      storageItem.sizeLabel, storageItem.variant, storageItem.patternLabel,
    ].filter(Boolean);
    tx.update(storageItems)
      .set({
        containerCount: balanced.containerCount,
        looseUnits: balanced.looseUnits,
        totalUnits: balanced.totalUnits,
        updatedAt: new Date(),
      })
      .where(eq(storageItems.id, storageItem.id))
      .run();

    tx.update(parts)
      .set({ stock: newStock, updatedAt: new Date() })
      .where(eq(parts.id, part.id))
      .run();

    tx.insert(stockMovements)
      .values({
        partId: part.id,
        type: "in",
        quantity: input.quantity,
        reference: referenceBits.join(" - "),
        note: input.note?.trim() || "Transferred from storage",
      })
      .run();
    return {
      success: true,
      movedQuantity: input.quantity,
      storageItemId: storageItem.id,
      partId: part.id,
    };
  }, { behavior: "immediate" });
}
