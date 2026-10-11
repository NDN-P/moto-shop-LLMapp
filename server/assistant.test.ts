import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { askAssistant, assistantQuestionSchema, assistantResultSchema, getAssistantDataMode } from "./assistant";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));
vi.mock("node:fs", async importOriginal => ({
  ...await importOriginal<typeof import("node:fs")>(), existsSync: vi.fn(),
}));

const valid = {
  dataMode: "sample",
  answer: "Motor oil is 200 THB.", sources: [1],
  trace: [{ tool: "get_part", arguments: { part_id: 1 }, status: "ok",
    result: { id: 1, name: "Motor oil", price: 200, stock: 4 } }],
};

describe("assistant bridge", () => {
  const end = vi.fn();
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-key");
    vi.stubEnv("OPENAI_BASE_URL", "https://proxy.invalid/v1");
    vi.stubEnv("DATABASE_URL", "file:./test-shop.db");
    vi.stubEnv("ASSISTANT_DATA_MODE", "sample");
    vi.stubEnv("PYTHON_EXECUTABLE", "test-python");
    vi.mocked(existsSync).mockReturnValue(true);
    end.mockClear();
    vi.mocked(execFile).mockImplementation(((_exe: unknown, _args: unknown, _options: unknown, callback: Function) => {
      queueMicrotask(() => callback(null, JSON.stringify(valid), ""));
      return { stdin: { end, on: vi.fn() } };
    }) as typeof execFile);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  it("uses a bounded subprocess without shell interpolation and sends JSON stdin", async () => {
    const question = 'oil; echo "hello"';
    expect(await askAssistant(question)).toEqual(valid);
    const [executable, args, options] = vi.mocked(execFile).mock.calls[0];
    expect(executable).toBe("test-python");
    expect(args).toHaveLength(1);
    expect(String(args?.[0])).toContain("agent.py");
    expect(options).toMatchObject({ timeout: 95000, maxBuffer: 1024 * 1024, windowsHide: true });
    expect(options).not.toHaveProperty("shell", true);
    expect(JSON.parse(end.mock.calls[0][0])).toEqual({ question });
    expect(options).not.toHaveProperty("env.DATABASE_URL");
    expect(options).toHaveProperty("env.ASSISTANT_DATA_MODE", "sample");
    expect(end.mock.calls[0][0]).not.toContain("test-only-key");
  });

  it("defaults to sample data and rejects unknown modes before spawning", async () => {
    vi.stubEnv("ASSISTANT_DATA_MODE", "");
    expect(getAssistantDataMode()).toBe("sample");
    expect((await askAssistant("oil")).dataMode).toBe("sample");
    vi.clearAllMocks();
    vi.stubEnv("ASSISTANT_DATA_MODE", "unknown");
    expect(() => getAssistantDataMode()).toThrow("ASSISTANT_DATA_MODE");
    await expect(askAssistant("oil")).rejects.toThrow("ASSISTANT_DATA_MODE");
    expect(execFile).not.toHaveBeenCalled();
  });

  it("passes the configured shop path only through trusted environment and sets authoritative result mode", async () => {
    vi.stubEnv("ASSISTANT_DATA_MODE", "shop");
    vi.stubEnv("OPENAI_BASE_URL", " https://llm.nat-d.uk/v1/ ");
    expect(getAssistantDataMode()).toBe("shop");
    // The child fixture claims sample; the server's configured mode controls the response.
    expect(await askAssistant("current stock")).toEqual({ ...valid, dataMode: "shop" });
    const options = vi.mocked(execFile).mock.calls[0][2];
    expect(options).toHaveProperty("env.ASSISTANT_DATA_MODE", "shop");
    expect(options).toHaveProperty("env.DATABASE_URL", "file:./test-shop.db");
    expect(options).toHaveProperty("env.OPENAI_BASE_URL", "https://llm.nat-d.uk/v1");
    expect(JSON.parse(end.mock.calls[0][0])).toEqual({ question: "current stock" });
    expect(end.mock.calls[0][0]).not.toContain("test-shop.db");
  });

  it("uses the application's default shop path when DATABASE_URL is absent", async () => {
    vi.stubEnv("ASSISTANT_DATA_MODE", "shop");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("OPENAI_BASE_URL", "https://llm.nat-d.uk/v1");
    await askAssistant("oil");
    expect(vi.mocked(execFile).mock.calls[0][2]).toHaveProperty("env.DATABASE_URL", "file:./moto-shop.db");
  });

  it("blocks shop data from any other proxy without exposing the configured URL", async () => {
    vi.stubEnv("ASSISTANT_DATA_MODE", "shop");
    await expect(askAssistant("oil")).rejects.toThrow("Shop inventory requires OPENAI_BASE_URL=https://llm.nat-d.uk/v1");
    await expect(askAssistant("oil")).rejects.not.toThrow("proxy.invalid");
    expect(execFile).not.toHaveBeenCalled();
  });

  it("requires both class proxy settings", async () => {
    vi.stubEnv("OPENAI_BASE_URL", "");
    await expect(askAssistant("oil")).rejects.toThrow("OPENAI_BASE_URL");
    expect(execFile).not.toHaveBeenCalled();
  });

  it("rejects invalid inputs before spawning", async () => {
    await expect(askAssistant(" ")).rejects.toThrow();
    expect(assistantQuestionSchema.safeParse({ question: "x".repeat(1001) }).success).toBe(false);
    expect(assistantQuestionSchema.safeParse({ question: "oil", dataMode: "shop" }).success).toBe(false);
    expect(assistantQuestionSchema.safeParse({ question: "oil", DATABASE_URL: "file:./other.db" }).success).toBe(false);
    expect(execFile).not.toHaveBeenCalled();
  });

  it("validates final citations against successful tool evidence", () => {
    expect(assistantResultSchema.safeParse({ ...valid, sources: [999] }).success).toBe(false);
    expect(assistantResultSchema.safeParse({ ...valid, sources: [1, 1] }).success).toBe(false);
    expect(assistantResultSchema.safeParse({ ...valid, trace: [{ ...valid.trace[0], status: "error" }] }).success).toBe(false);
    expect(assistantResultSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
    expect(assistantResultSchema.safeParse({ ...valid, dataMode: "shop" }).success).toBe(true);
    expect(assistantResultSchema.safeParse({ ...valid, dataMode: "other" }).success).toBe(false);
    expect(assistantResultSchema.safeParse({ ...valid, dataMode: undefined }).success).toBe(false);
  });

  it("returns only the trusted mode from authenticated configuration without invoking Python", async () => {
    const caller = appRouter.createCaller({
      user: { id: 1, openId: "test-user", role: "admin" } as TrpcContext["user"],
      req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
    });
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await caller.assistant.config()).toEqual({ dataMode: "sample" });
    vi.stubEnv("ASSISTANT_DATA_MODE", "shop");
    expect(await caller.assistant.config()).toEqual({ dataMode: "shop" });
    expect(execFile).not.toHaveBeenCalled();
  });

  it("requires login for configuration and questions", async () => {
    const caller = appRouter.createCaller({ user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });
    await expect(caller.assistant.config()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.assistant.ask({ question: "oil" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(execFile).not.toHaveBeenCalled();
  });

  it("does not expose upstream stderr, credentials or command errors", async () => {
    vi.mocked(execFile).mockImplementation(((_exe: unknown, _args: unknown, _options: unknown, callback: Function) => {
      queueMicrotask(() => callback(new Error("test-only-key"), "", "secret upstream text"));
      return { stdin: { end, on: vi.fn() } };
    }) as typeof execFile);
    await expect(askAssistant("oil")).rejects.toThrow("Check Python requirements");
    await expect(askAssistant("oil")).rejects.not.toThrow("test-only-key");
  });
});
