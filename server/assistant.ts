import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

export const assistantQuestionSchema = z.object({
  question: z.string().trim().min(1).max(1000),
}).strict();

export const assistantDataModeSchema = z.enum(["sample", "shop"]);

export function getAssistantDataMode() {
  const result = assistantDataModeSchema.safeParse(process.env.ASSISTANT_DATA_MODE || "sample");
  if (!result.success) throw new Error("ASSISTANT_DATA_MODE must be sample or shop.");
  return result.data;
}

export const assistantResultSchema = z.object({
  dataMode: assistantDataModeSchema,
  answer: z.string().trim().min(1).max(6000),
  sources: z.array(z.number().int().positive()).max(20),
  trace: z.array(z.object({
    tool: z.string().max(80),
    arguments: z.record(z.string(), z.unknown()),
    status: z.enum(["ok", "error", "blocked"]),
    result: z.unknown(),
  }).strict()).max(6),
}).strict().superRefine((response, ctx) => {
  const evidence = new Set<number>();
  for (const entry of response.trace) {
    if (entry.status !== "ok" || !["search_parts", "get_part", "get_low_stock"].includes(entry.tool)) continue;
    const rows = Array.isArray(entry.result) ? entry.result : [entry.result];
    for (const row of rows) {
      if (row && typeof row === "object" && "id" in row && Number.isInteger(row.id)) {
        evidence.add(row.id as number);
      }
    }
  }
  if (new Set(response.sources).size !== response.sources.length || response.sources.some(id => !evidence.has(id))) {
    ctx.addIssue({ code: "custom", path: ["sources"], message: "Unverified source IDs" });
  }
});

export type AssistantResult = z.infer<typeof assistantResultSchema>;

export async function askAssistant(question: string): Promise<AssistantResult> {
  question = assistantQuestionSchema.parse({ question }).question;
  const dataMode = getAssistantDataMode();
  if (!process.env.OPENAI_API_KEY?.trim() || !process.env.OPENAI_BASE_URL?.trim()) {
    throw new Error("Configure OPENAI_API_KEY and OPENAI_BASE_URL for the course proxy.");
  }
  if (dataMode === "shop" && process.env.OPENAI_BASE_URL.trim().replace(/\/+$/, "") !== "https://llm.nat-d.uk/v1") {
    throw new Error("Shop inventory requires OPENAI_BASE_URL=https://llm.nat-d.uk/v1.");
  }
  const root = process.cwd();
  const localPython = path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const executable = process.env.PYTHON_EXECUTABLE || (existsSync(localPython) ? localPython : "python");
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ASSISTANT_DATA_MODE: dataMode, PYTHONIOENCODING: "utf-8" };
  if (dataMode === "shop") {
    childEnv.DATABASE_URL = process.env.DATABASE_URL || "file:./moto-shop.db";
    childEnv.OPENAI_BASE_URL = "https://llm.nat-d.uk/v1";
  } else delete childEnv.DATABASE_URL;

  return new Promise((resolve, reject) => {
    const child = execFile(executable, [path.join(root, "assistant", "agent.py")], {
      cwd: root, timeout: 95000, maxBuffer: 1024 * 1024, windowsHide: true,
      env: childEnv,
    }, (error, stdout) => {
      if (error) {
        reject(new Error("Assistant unavailable. Check Python requirements and course proxy configuration."));
        return;
      }
      try {
        resolve(assistantResultSchema.parse({ ...JSON.parse(stdout), dataMode }));
      } catch {
        reject(new Error("The assistant returned an invalid response. Please retry."));
      }
    });
    child.stdin?.on("error", () => reject(new Error("Could not send the assistant request.")));
    child.stdin?.end(JSON.stringify({ question }) + "\n");
  });
}
