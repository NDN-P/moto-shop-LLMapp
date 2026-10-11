import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { askAssistant, assistantQuestionSchema, assistantResultSchema } from "./assistant";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));
vi.mock("node:fs", () => ({ existsSync: vi.fn() }));

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
    expect(options).toHaveProperty("env.DATABASE_URL", undefined);
    expect(end.mock.calls[0][0]).not.toContain("test-only-key");
  });

  it("defaults to sample data and rejects shop mode before spawning", async () => {
    vi.stubEnv("ASSISTANT_DATA_MODE", "");
    expect((await askAssistant("oil")).dataMode).toBe("sample");
    vi.clearAllMocks();
    vi.stubEnv("ASSISTANT_DATA_MODE", "shop");
    await expect(askAssistant("oil")).rejects.toThrow("Only the invented sample catalog");
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
    expect(execFile).not.toHaveBeenCalled();
  });

  it("validates final citations against successful tool evidence", () => {
    expect(assistantResultSchema.safeParse({ ...valid, sources: [999] }).success).toBe(false);
    expect(assistantResultSchema.safeParse({ ...valid, sources: [1, 1] }).success).toBe(false);
    expect(assistantResultSchema.safeParse({ ...valid, trace: [{ ...valid.trace[0], status: "error" }] }).success).toBe(false);
    expect(assistantResultSchema.safeParse({ ...valid, extra: true }).success).toBe(false);
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
