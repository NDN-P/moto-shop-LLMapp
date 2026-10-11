import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createSession, destroySession, getSessionIdFromRequest, validateCredentials } from "./auth-local";
import { askAssistant, assistantQuestionSchema } from "./assistant";
import {
  createPart,
  createStorageItem,
  createSupplier,
  deletePart,
  deleteStorageItem,
  deleteStockMovement,
  deleteSupplier,
  getCategories,
  getDashboardSummary,
  getPartById,
  getSupplierById,
  getTopSellers,
  getTrends,
  listParts,
  listStockMovements,
  listStorageItems,
  listSuppliers,
  recordStockMovement,
  transferStorageToInventory,
  updatePart,
  updateStorageItem,
  updateStockMovement,
  updateSupplier,
} from "./db";

const money = z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "Enter a nonnegative price with at most two decimals").refine(value => Number(value) <= 1_000_000_000, "Price is too large");

export const appRouter = router({
  system: systemRouter,
  assistant: router({
    ask: protectedProcedure.input(assistantQuestionSchema).mutation(({ input }) => askAssistant(input.question)),
  }),
  auth: router({
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(({ input, ctx }) => {
        if (!validateCredentials(input.username, input.password)) {
          throw new Error("Invalid username or password");
        }
        const sessionId = createSession(input.username);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionId, { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 });
        return { success: true, username: input.username };
      }),
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const sessionId = getSessionIdFromRequest(ctx.req);
      if (sessionId) destroySession(sessionId);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  suppliers: router({
    list: protectedProcedure.query(() => listSuppliers()),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => getSupplierById(input.id)),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          contactName: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().email().optional().or(z.literal("")),
          address: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => createSupplier(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).optional(),
          contactName: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().email().optional().or(z.literal("")),
          address: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateSupplier(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteSupplier(input.id)),
  }),
  parts: router({
    list: protectedProcedure
      .input(
        z.object({
          search: z.string().optional(),
          category: z.string().optional(),
          supplierId: z.number().int().positive().optional(),
          lowStock: z.boolean().optional(),
        }).optional()
      )
      .query(({ input }) => listParts(input)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => getPartById(input.id)),
    categories: protectedProcedure.query(() => getCategories()),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          category: z.string().optional(),
          sku: z.string().optional(),
          price: money,
          stock: z.number().int().min(0).optional(),
          minStock: z.number().int().min(0).optional(),
          description: z.string().optional(),
          supplierId: z.number().int().positive().optional(),
          imageUrl: z.string().optional(),
        })
      )
      .mutation(({ input }) => createPart(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).optional(),
          category: z.string().optional(),
          sku: z.string().optional(),
          price: money.optional(),
          stock: z.number().int().min(0).optional(),
          minStock: z.number().int().min(0).optional(),
          description: z.string().optional(),
          supplierId: z.number().int().positive().nullable().optional(),
          isActive: z.boolean().optional(),
          imageUrl: z.string().nullable().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updatePart(id, data);
      }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deletePart(input.id)),
  }),
  stock: router({
    list: protectedProcedure
      .input(
        z.object({
          partId: z.number().int().positive().optional(),
          type: z.enum(["in", "out"]).optional(),
          from: z.date().optional(),
          to: z.date().optional(),
          limit: z.number().int().min(1).max(1000).optional(),
        }).optional()
      )
      .query(({ input }) => listStockMovements(input)),
    record: protectedProcedure
      .input(
        z.object({
          partId: z.number().int().positive(),
          type: z.enum(["in", "out"]),
          quantity: z.number().int().min(1),
          note: z.string().optional(),
          reference: z.string().optional(),
          unitPrice: money.optional(),
        })
      )
      .mutation(({ input }) => recordStockMovement(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          partId: z.number().int().positive(),
          type: z.enum(["in", "out"]),
          quantity: z.number().int().min(1),
          note: z.string().optional(),
          reference: z.string().optional(),
          unitPrice: money.optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateStockMovement(id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteStockMovement(input.id)),
  }),
  dashboard: router({
    summary: protectedProcedure.query(() => getDashboardSummary()),
    topSellers: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(1000).optional() }).optional())
      .query(({ input }) => getTopSellers(input?.limit ?? 5)),
    trends: protectedProcedure
      .input(z.object({ period: z.enum(["day", "week", "month"]) }))
      .query(({ input }) => getTrends(input.period)),
  }),
  storage: router({
    list: protectedProcedure.query(() => listStorageItems()),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          type: z.enum(["oil", "tire", "tube", "other"]),
          subcategory: z.string().optional(),
          brand: z.string().optional(),
          variant: z.string().optional(),
          sizeLabel: z.string().optional(),
          patternLabel: z.string().optional(),
          containerCount: z.number().int().min(0),
          unitsPerContainer: z.number().int().min(0),
          looseUnits: z.number().int().min(0).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => createStorageItem(input)),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).optional(),
          type: z.enum(["oil", "tire", "tube", "other"]).optional(),
          subcategory: z.string().optional(),
          brand: z.string().optional(),
          variant: z.string().optional(),
          sizeLabel: z.string().optional(),
          patternLabel: z.string().optional(),
          containerCount: z.number().int().min(0).optional(),
          unitsPerContainer: z.number().int().min(0).optional(),
          looseUnits: z.number().int().min(0).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ input }) => {
        const { id, ...data } = input;
        return updateStorageItem(id, data);
      }),
    transferToInventory: protectedProcedure
      .input(
        z.object({
          storageItemId: z.number().int().positive(),
          partId: z.number().int().positive(),
          quantity: z.number().int().min(1),
          note: z.string().optional(),
        })
      )
      .mutation(({ input }) => transferStorageToInventory(input)),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteStorageItem(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
