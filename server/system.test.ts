import { expect, it } from "vitest";
import { systemRouter } from "./_core/systemRouter";
import type { TrpcContext } from "./_core/context";

it("keeps the local public health check without external service actions", async () => {
  const caller = systemRouter.createCaller({ user: null } as TrpcContext);
  expect(await caller.health({ timestamp: Date.now() })).toEqual({ ok: true });
  expect(Object.keys(systemRouter._def.procedures)).toEqual(["health"]);
});
