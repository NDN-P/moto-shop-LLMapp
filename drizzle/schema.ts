import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp_ms" }).notNull().default(new Date()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contactName: text("contactName"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

export const parts = sqliteTable("parts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sku: text("sku"),
  category: text("category"),
  price: text("price").notNull(),
  stock: integer("stock").notNull().default(0),
  minStock: integer("minStock").notNull().default(5),
  description: text("description"),
  supplierId: integer("supplierId"),
  isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
  imageUrl: text("imageUrl"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
});

export type Part = typeof parts.$inferSelect;
export type InsertPart = typeof parts.$inferInsert;

export const stockMovements = sqliteTable("stock_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partId: integer("partId").notNull(),
  type: text("type", { enum: ["in", "out"] }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: text("unitPrice"),
  reference: text("reference"),
  note: text("note"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
});

export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = typeof stockMovements.$inferInsert;

export const storageItems = sqliteTable("storage_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: ["oil", "tire", "tube", "other"] }).notNull(),
  subcategory: text("subcategory"),
  brand: text("brand"),
  variant: text("variant"),
  sizeLabel: text("sizeLabel"),
  patternLabel: text("patternLabel"),
  containerCount: integer("containerCount").notNull().default(0),
  unitsPerContainer: integer("unitsPerContainer").notNull().default(0),
  looseUnits: integer("looseUnits").notNull().default(0),
  totalUnits: integer("totalUnits").notNull().default(0),
  label: text("label"),
  notes: text("notes"),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(new Date()),
});

export type StorageItem = typeof storageItems.$inferSelect;
export type InsertStorageItem = typeof storageItems.$inferInsert;
