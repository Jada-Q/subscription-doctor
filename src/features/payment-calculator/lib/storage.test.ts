import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadOwnedIds, saveOwnedIds, loadCustomMethods, saveCustomMethods } from "./storage";
import type { PaymentMethod } from "../data/templates";

const storage = new Map<string, string>();

function makeStorageMock() {
  return {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeItem: vi.fn((key: string) => storage.delete(key)),
    clear: vi.fn(() => storage.clear()),
    get length() { return storage.size; },
    key: vi.fn(() => null),
  };
}

let localStorageMock = makeStorageMock();

Object.defineProperty(globalThis, "localStorage", {
  get: () => localStorageMock,
  configurable: true,
});

describe("payment storage", () => {
  beforeEach(() => {
    storage.clear();
    localStorageMock = makeStorageMock();
  });

  describe("ownedIds", () => {
    it("returns empty array when nothing saved", () => {
      expect(loadOwnedIds()).toEqual([]);
    });

    it("saves and loads owned card IDs", () => {
      saveOwnedIds(["rakuten_card", "smbc_nl"]);
      expect(loadOwnedIds()).toEqual(["rakuten_card", "smbc_nl"]);
    });

    it("overwrites previous data", () => {
      saveOwnedIds(["a", "b"]);
      saveOwnedIds(["c"]);
      expect(loadOwnedIds()).toEqual(["c"]);
    });

    it("handles localStorage error gracefully", () => {
      localStorageMock.getItem = vi.fn(() => { throw new Error("quota"); });
      expect(loadOwnedIds()).toEqual([]);
    });
  });

  describe("customMethods", () => {
    it("returns empty array when nothing saved", () => {
      expect(loadCustomMethods()).toEqual([]);
    });

    it("saves and loads custom methods", () => {
      const method: PaymentMethod = {
        id: "custom_1",
        name: "My Card",
        type: "credit",
        baseRate: 0.01,
        categoryRates: [],
        campaigns: [],
        color: "#000",
      };
      saveCustomMethods([method]);
      const loaded = loadCustomMethods();
      expect(loaded.length).toBe(1);
      expect(loaded[0].id).toBe("custom_1");
      expect(loaded[0].baseRate).toBe(0.01);
    });

    it("handles save error gracefully", () => {
      localStorageMock.setItem = vi.fn(() => { throw new Error("quota"); });
      expect(() => saveCustomMethods([])).not.toThrow();
    });
  });
});
