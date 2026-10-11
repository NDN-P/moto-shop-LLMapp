import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { parts, stockMovements, storageItems, suppliers } from "../drizzle/schema";
import {
  createPart, createStorageItem, createSupplier, deletePart, deleteStockMovement,
  deleteSupplier, getDb, getPartById, getStorageItemById, listStockMovements,
  recordStockMovement, transferStorageToInventory, updatePart, updateStockMovement,
} from "./db";

let db: Awaited<ReturnType<typeof getDb>>;
let tempRoot: string;
let fixtureRoot: string;

beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", ":memory:");
  db = await getDb();
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "moto-db-test-"));
});

beforeEach(() => {
  vi.restoreAllMocks();
  for (const name of ["fail_insert", "fail_update", "fail_delete", "fail_supplier_delete"]) db.run(sql.raw(`DROP TRIGGER IF EXISTS ${name}`));
  for (const table of [stockMovements, storageItems, parts, suppliers]) db.delete(table).run();
  fixtureRoot = fs.mkdtempSync(path.join(tempRoot, "case-"));
  vi.spyOn(process, "cwd").mockReturnValue(fixtureRoot);
});

afterAll(() => {
  vi.restoreAllMocks();
  db.$client.close();
  vi.unstubAllEnvs();
  if (path.dirname(path.resolve(tempRoot)) !== path.resolve(os.tmpdir()) || !path.basename(tempRoot).startsWith("moto-db-test-")) {
    throw new Error("Unexpected test cleanup path");
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

const part = (stock = 10, imageUrl?: string) => createPart({ name: "Test part", price: "10.00", stock, imageUrl });
const fail = (operation: "INSERT" | "UPDATE" | "DELETE") => db.run(sql.raw(
  `CREATE TRIGGER fail_${operation.toLowerCase()} BEFORE ${operation} ON stock_movements BEGIN SELECT RAISE(ABORT, 'test failure'); END`
));

describe("atomic inventory movements", () => {
  it("rolls back a balance change if recording history fails", async () => {
    const p = await part();
    fail("INSERT");
    await expect(recordStockMovement({ partId: p.id, type: "out", quantity: 3 })).rejects.toThrow("test failure");
    expect((await getPartById(p.id))?.stock).toBe(10);
    expect(await listStockMovements()).toHaveLength(0);
  });

  it("serializes competing withdrawals without losing stock", async () => {
    const p = await part();
    const results = await Promise.allSettled([
      recordStockMovement({ partId: p.id, type: "out", quantity: 6 }),
      recordStockMovement({ partId: p.id, type: "out", quantity: 6 }),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await getPartById(p.id))?.stock).toBe(4);
    expect(await listStockMovements()).toHaveLength(1);
  });

  it("reverses the old effect when moving a movement to another part", async () => {
    const first = await part(5);
    const second = await part(10);
    const movement = await recordStockMovement({ partId: first.id, type: "in", quantity: 3 });
    await updateStockMovement(movement.id, { partId: second.id, type: "out", quantity: 2 });
    expect((await getPartById(first.id))?.stock).toBe(5);
    expect((await getPartById(second.id))?.stock).toBe(8);
    expect(await listStockMovements()).toMatchObject([{ partId: second.id, type: "out", quantity: 2 }]);
  });

  it("corrects and then deletes a movement without losing the opening balance", async () => {
    const p = await part();
    const movement = await recordStockMovement({ partId: p.id, type: "out", quantity: 3 });
    await updateStockMovement(movement.id, { partId: p.id, type: "out", quantity: 5 });
    expect((await getPartById(p.id))?.stock).toBe(5);
    await deleteStockMovement(movement.id);
    expect((await getPartById(p.id))?.stock).toBe(10);
    expect(await listStockMovements()).toHaveLength(0);
  });

  it("rolls back both part balances if editing history fails", async () => {
    const first = await part(5);
    const second = await part(10);
    const movement = await recordStockMovement({ partId: first.id, type: "in", quantity: 3 });
    fail("UPDATE");
    await expect(updateStockMovement(movement.id, { partId: second.id, type: "out", quantity: 2 })).rejects.toThrow("test failure");
    expect((await getPartById(first.id))?.stock).toBe(8);
    expect((await getPartById(second.id))?.stock).toBe(10);
    expect(await listStockMovements()).toMatchObject([{ partId: first.id, type: "in", quantity: 3 }]);
  });

  it("rolls back stock if deleting history fails", async () => {
    const p = await part();
    const movement = await recordStockMovement({ partId: p.id, type: "out", quantity: 3 });
    fail("DELETE");
    await expect(deleteStockMovement(movement.id)).rejects.toThrow("test failure");
    expect((await getPartById(p.id))?.stock).toBe(7);
    expect(await listStockMovements()).toHaveLength(1);
  });

  it("rejects deleting consumed inbound stock without changing history", async () => {
    const p = await part(0);
    const inbound = await recordStockMovement({ partId: p.id, type: "in", quantity: 3 });
    await recordStockMovement({ partId: p.id, type: "out", quantity: 2 });
    await expect(deleteStockMovement(inbound.id)).rejects.toThrow();
    expect((await getPartById(p.id))?.stock).toBe(1);
    expect(await listStockMovements()).toHaveLength(2);
  });

  it.each([0, -1, 1.5, Infinity, NaN])("rejects invalid movement quantity %s", async quantity => {
    const p = await part();
    await expect(recordStockMovement({ partId: p.id, type: "out", quantity })).rejects.toThrow();
    expect((await getPartById(p.id))?.stock).toBe(10);
  });

  it("rejects an overflowing balance and invalid unit price before changing stock", async () => {
    const p = await part(Number.MAX_SAFE_INTEGER);
    await expect(recordStockMovement({ partId: p.id, type: "in", quantity: 1 })).rejects.toThrow();
    await expect(recordStockMovement({ partId: p.id, type: "out", quantity: 1, unitPrice: "NaN" })).rejects.toThrow();
    expect((await getPartById(p.id))?.stock).toBe(Number.MAX_SAFE_INTEGER);
    expect(await listStockMovements()).toHaveLength(0);
  });
});

describe("atomic storage transfers", () => {
  it("rejects a fractional transfer without changing either balance", async () => {
    const p = await part(0);
    const stored = await createStorageItem({ name: "Test storage", type: "oil", containerCount: 1, unitsPerContainer: 10 });
    await expect(transferStorageToInventory({ storageItemId: stored.id, partId: p.id, quantity: 0.5 })).rejects.toThrow();
    expect((await getStorageItemById(stored.id))?.totalUnits).toBe(10);
    expect((await getPartById(p.id))?.stock).toBe(0);
  });

  it("prevents two transfers from spending the same storage units", async () => {
    const p = await part(0);
    const stored = await createStorageItem({ name: "Test storage", type: "oil", containerCount: 1, unitsPerContainer: 10 });
    const results = await Promise.allSettled([
      transferStorageToInventory({ storageItemId: stored.id, partId: p.id, quantity: 6 }),
      transferStorageToInventory({ storageItemId: stored.id, partId: p.id, quantity: 6 }),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await getStorageItemById(stored.id)).toMatchObject({ containerCount: 0, looseUnits: 4, totalUnits: 4 });
    expect((await getPartById(p.id))?.stock).toBe(6);
    expect(await listStockMovements()).toHaveLength(1);
  });

  it("rolls back storage and shop balances when history fails", async () => {
    const p = await part(0);
    const stored = await createStorageItem({ name: "Test storage", type: "oil", containerCount: 1, unitsPerContainer: 10 });
    fail("INSERT");
    await expect(transferStorageToInventory({ storageItemId: stored.id, partId: p.id, quantity: 6 })).rejects.toThrow("test failure");
    expect((await getStorageItemById(stored.id))?.totalUnits).toBe(10);
    expect((await getPartById(p.id))?.stock).toBe(0);
  });
});

describe("safe catalog deletion", () => {
  it("keeps products and images that have movement history", async () => {
    const imageDir = path.join(fixtureRoot, "uploads", "products");
    fs.mkdirSync(imageDir, { recursive: true });
    const image = path.join(imageDir, "history.png");
    fs.writeFileSync(image, "test");
    const p = await part(10, "/uploads/products/history.png");
    await recordStockMovement({ partId: p.id, type: "out", quantity: 1 });
    await expect(deletePart(p.id)).rejects.toThrow(/history/i);
    expect(await getPartById(p.id)).not.toBeNull();
    expect(fs.existsSync(image)).toBe(true);
  });

  it("detaches products before deleting their supplier", async () => {
    const supplier = await createSupplier({ name: "Test supplier" });
    const p = await createPart({ name: "Test part", price: "1", supplierId: supplier.id });
    await deleteSupplier(supplier.id);
    expect((await getPartById(p.id))?.supplierId).toBeNull();
    expect(db.select().from(suppliers).all()).toHaveLength(0);
  });

  it("keeps supplier links when supplier deletion fails", async () => {
    const supplier = await createSupplier({ name: "Test supplier" });
    const p = await createPart({ name: "Test part", price: "1", supplierId: supplier.id });
    db.run(sql.raw("CREATE TRIGGER fail_supplier_delete BEFORE DELETE ON suppliers BEGIN SELECT RAISE(ABORT, 'test failure'); END"));
    await expect(deleteSupplier(supplier.id)).rejects.toThrow("test failure");
    expect((await getPartById(p.id))?.supplierId).toBe(supplier.id);
    expect(db.select().from(suppliers).all()).toHaveLength(1);
  });

  it("deletes an ordinary product image only after removing the product", async () => {
    const imageDir = path.join(fixtureRoot, "uploads", "products");
    fs.mkdirSync(imageDir, { recursive: true });
    const image = path.join(imageDir, "safe.png");
    fs.writeFileSync(image, "test");
    const p = await part(10, "/uploads/products/safe.png");
    await deletePart(p.id);
    expect(await getPartById(p.id)).toBeNull();
    expect(fs.existsSync(image)).toBe(false);
  });

  it("preserves an image still used by another product", async () => {
    const imageDir = path.join(fixtureRoot, "uploads", "products");
    fs.mkdirSync(imageDir, { recursive: true });
    const image = path.join(imageDir, "shared.png");
    fs.writeFileSync(image, "test");
    const first = await part(10, "/uploads/products/shared.png");
    await part(10, "/uploads/products/shared.png");
    await deletePart(first.id);
    expect(fs.existsSync(image)).toBe(true);
  });

  it.each(["important.png", "/uploads/products/../../important.png", "uploads\\products\\..\\..\\important.png"])("does not delete project files supplied as image path %s", async imageUrl => {
    const outside = path.join(fixtureRoot, "important.png");
    fs.writeFileSync(outside, "keep");
    const p = await part(10, imageUrl);
    await deletePart(p.id);
    expect(fs.readFileSync(outside, "utf8")).toBe("keep");
  });

  it("does not follow a junction in the product image directory", async () => {
    const outside = path.join(fixtureRoot, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "keep.png"), "keep");
    fs.mkdirSync(path.join(fixtureRoot, "uploads"));
    fs.symlinkSync(outside, path.join(fixtureRoot, "uploads", "products"), "junction");
    const p = await part(10, "/uploads/products/keep.png");
    await deletePart(p.id);
    expect(fs.readFileSync(path.join(outside, "keep.png"), "utf8")).toBe("keep");
  });
});

describe("service input validation", () => {
  it.each(["", "-1", "NaN", "Infinity", "free", "1.234"])("rejects invalid price %s", async price => {
    await expect(createPart({ name: "Invalid", price })).rejects.toThrow();
    expect(db.select().from(parts).all()).toHaveLength(0);
  });

  it("rejects invalid updated prices without changing an existing part", async () => {
    const p = await part();
    await expect(updatePart(p.id, { price: "-1" })).rejects.toThrow();
    expect((await getPartById(p.id))?.price).toBe("10.00");
  });

  it("rejects nonexistent supplier references when creating or editing products", async () => {
    await expect(createPart({ name: "Invalid", price: "1", supplierId: 999999 })).rejects.toThrow("Supplier not found");
    const p = await part();
    await expect(updatePart(p.id, { supplierId: 999999 })).rejects.toThrow("Supplier not found");
    expect((await getPartById(p.id))?.supplierId).toBeNull();
    expect(db.select().from(parts).all()).toHaveLength(1);
  });
});
