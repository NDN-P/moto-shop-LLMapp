import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageItem } from "@shared/types";

const query = vi.hoisted(() => ({ items: [] as StorageItem[] }));

vi.mock("@/components/DashboardLayout", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ isPending: false, mutate: vi.fn() }) };
  return {
    trpc: {
      useUtils: () => ({}),
      storage: {
        list: { useQuery: () => ({ data: query.items, isLoading: false }) },
        create: mutation,
        update: mutation,
        delete: mutation,
        transferToInventory: mutation,
      },
      parts: { list: { useQuery: () => ({ data: [] }) } },
    },
  };
});

import Storage from "./Storage";

describe("storage categories", () => {
  beforeEach(() => {
    query.items = [];
  });

  it("shows existing API enum values in all four Thai-labelled groups", () => {
    query.items = (["oil", "tire", "tube", "other"] as const).map((type, index) => ({
      id: index + 1,
      name: `${type} regression item`,
      type,
      subcategory: null,
      brand: null,
      variant: null,
      sizeLabel: null,
      patternLabel: null,
      containerCount: 2,
      unitsPerContainer: 10,
      looseUnits: 1,
      totalUnits: 21,
      label: null,
      notes: null,
      updatedAt: new Date(0),
    }));

    const markup = renderToStaticMarkup(createElement(Storage));
    for (const item of query.items) {
      expect(markup).toContain(item.name);
    }
    for (const label of ["น้ำมันเครื่อง", "ยางนอก", "ยางใน", "อื่นๆ"]) {
      expect(markup).toContain(label);
    }
    expect(markup.match(/Move to Shop</g)).toHaveLength(4);
    expect(markup).not.toContain("No น้ำมันเครื่อง items");
  });

  it("keeps all four empty category sections visible", () => {
    const markup = renderToStaticMarkup(createElement(Storage));
    for (const label of ["น้ำมันเครื่อง", "ยางนอก", "ยางใน", "อื่นๆ"]) {
      expect(markup).toContain(`No ${label} items`);
    }
  });
});
