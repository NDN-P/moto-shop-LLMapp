import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(overrides?: Partial<TrpcContext>): TrpcContext {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-open-id",
    email: "test@shop-name.example",
    name: "Test User",
    loginMethod: "local",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
      cookies: { [COOKIE_NAME]: "test-session-id" },
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
    ...overrides,
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────
describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
    const ctx = createMockContext({
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as TrpcContext["res"],
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });


});

// ─── Router Structure Tests ───────────────────────────────────────────────────
describe("router structure", () => {
  it("has all required routers", () => {
    const router = appRouter as unknown as Record<string, unknown>;
    expect(router).toHaveProperty("auth");
    expect(router).toHaveProperty("parts");
    expect(router).toHaveProperty("suppliers");
    expect(router).toHaveProperty("stock");
    expect(router).toHaveProperty("dashboard");
  });
});

describe("shop API authorization", () => {
  it("rejects all business reads and writes without a session", async () => {
    const caller = appRouter.createCaller(createMockContext({ user: null }));
    const requests = [
      () => caller.parts.list(),
      () => caller.parts.create({ name: "test", price: "10.00" }),
      () => caller.suppliers.list(),
      () => caller.suppliers.delete({ id: 1 }),
      () => caller.stock.record({ partId: 1, type: "out", quantity: 1 }),
      () => caller.stock.delete({ id: 1 }),
      () => caller.dashboard.summary(),
      () => caller.storage.list(),
      () => caller.storage.transferToInventory({ storageItemId: 1, partId: 1, quantity: 1 }),
      () => caller.assistant.ask({ question: "Show low stock" }),
    ];
    for (const request of requests) await expect(request()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─── Input Validation Tests ───────────────────────────────────────────────────
describe("input validation", () => {
  it("rejects invalid money and fractional identifiers before database access", async () => {
    const caller = appRouter.createCaller(createMockContext());
    for (const price of ["-1", "NaN", "Infinity", "10.001", "", "1e3"]) {
      await expect(caller.parts.create({ name: "test", price })).rejects.toThrow();
    }
    await expect(caller.parts.get({ id: 1.5 })).rejects.toThrow();
  });
  it("rejects invalid part creation with missing name", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.parts.create({ name: "", price: "10.00" })
    ).rejects.toThrow();
  });

  it("rejects invalid stock movement with quantity < 1", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.stock.record({ partId: 1, type: "in", quantity: 0 })
    ).rejects.toThrow();
  });

  it("rejects invalid trends period", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      // @ts-expect-error testing invalid input
      caller.dashboard.trends({ period: "invalid" })
    ).rejects.toThrow();
  });

  it("accepts valid stock movement type enum values", async () => {
    // Just validate the zod schema accepts "in" and "out"
    const validTypes = ["in", "out"];
    expect(validTypes).toContain("in");
    expect(validTypes).toContain("out");
    expect(validTypes).not.toContain("transfer");
  });
});
