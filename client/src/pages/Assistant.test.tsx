import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantResult } from "../../../server/assistant";

const state = vi.hoisted(() => ({
  config: { data: undefined as { dataMode: "sample" | "shop" } | undefined, error: null as Error | null, isFetching: false, refetch: vi.fn() },
  result: undefined as AssistantResult | undefined,
}));

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/AIChatBox", () => ({
  AIChatBox: ({ placeholder }: { placeholder: string }) => createElement("div", { "data-chat": placeholder }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: { assistant: {
    config: { useQuery: () => state.config },
    ask: { useMutation: () => ({ data: state.result, isPending: false, error: null, reset: vi.fn(), mutate: vi.fn() }) },
  } },
}));

import Assistant from "./Assistant";

describe("assistant inventory disclosure", () => {
  beforeEach(() => { state.config.data = undefined; state.config.error = null; state.config.isFetching = false; state.result = undefined; });

  it("waits for configuration without assuming sample mode or enabling chat", () => {
    const markup = renderToStaticMarkup(createElement(Assistant));
    expect(markup).toContain("Checking inventory mode");
    expect(markup).toContain("Loading assistant configuration");
    expect(markup).not.toContain("Sample catalog");
    expect(markup).not.toContain("Shop inventory");
    expect(markup).not.toContain("data-chat");
  });

  it("waits for refreshed configuration instead of presenting a cached sample setting", () => {
    state.config.data = { dataMode: "sample" };
    state.config.isFetching = true;
    const markup = renderToStaticMarkup(createElement(Assistant));
    expect(markup).toContain("Checking inventory mode");
    expect(markup).not.toContain("Sample catalog");
    expect(markup).not.toContain("data-chat");
  });

  it("does not show stale sample configuration or chat after a configuration error", () => {
    state.config.data = { dataMode: "sample" };
    state.config.error = new Error("Configuration unavailable");
    const markup = renderToStaticMarkup(createElement(Assistant));
    expect(markup).toContain("Inventory mode unavailable");
    expect(markup).toContain("Configuration unavailable");
    expect(markup).toContain("Retry");
    expect(markup).not.toContain("Sample catalog");
    expect(markup).not.toContain("data-chat");
  });

  it("shows the shop data boundary before any question", () => {
    state.config.data = { dataMode: "shop" };
    const markup = renderToStaticMarkup(createElement(Assistant));
    expect(markup).toContain("Shop inventory");
    expect(markup).toContain("selected product details");
    expect(markup).toContain("configured course proxy");
    expect(markup).toContain("cannot change inventory");
    expect(markup).toContain("complete shop inventory question");
    expect(markup).not.toContain("Sample catalog");
  });

  it("keeps the fictional sample disclosure in sample mode", () => {
    state.config.data = { dataMode: "sample" };
    const markup = renderToStaticMarkup(createElement(Assistant));
    expect(markup).toContain("Sample catalog");
    expect(markup).toContain("Real shop inventory is not queried in sample mode");
    expect(markup).toContain("complete sample catalog question");
  });

  it("labels real answer evidence and stock with the authoritative response mode", () => {
    state.config.data = { dataMode: "sample" };
    state.result = {
      dataMode: "shop", answer: "Part 6 has 4 units.", sources: [6],
      trace: [{ tool: "get_part", arguments: { part_id: 6 }, status: "ok", result: { id: 6, name: "Test product", price: 100, stock: 4 } }],
    };
    const markup = renderToStaticMarkup(createElement(Assistant));
    expect(markup).toContain("Shop inventory sources");
    expect(markup).toContain("Current stock at lookup");
    expect(markup).toContain("Test product");
    expect(markup).not.toContain("Sample sources");
    expect(markup).not.toContain("Sample catalog");
  });
});
