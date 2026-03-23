import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, recordScan } from "./rate-limit";

// Mock localStorage
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() { return storage.size; },
  key: vi.fn(() => null),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("rate-limit", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("allows first scan", () => {
    const result = checkRateLimit();
    expect(result.allowed).toBe(true);
  });

  it("allows up to 30 scans per hour", () => {
    for (let i = 0; i < 30; i++) {
      recordScan();
    }
    const result = checkRateLimit();
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(3600000);
    }
  });

  it("allows scans after old timestamps expire", () => {
    const oneHourAgo = Date.now() - 3600001;
    storage.set(
      "subsc-doctor-scans",
      JSON.stringify({ timestamps: Array(30).fill(oneHourAgo) })
    );
    const result = checkRateLimit();
    expect(result.allowed).toBe(true);
  });

  it("recordScan adds timestamp", () => {
    recordScan();
    const raw = storage.get("subsc-doctor-scans");
    expect(raw).toBeTruthy();
    const record = JSON.parse(raw!);
    expect(record.timestamps.length).toBe(1);
    expect(record.timestamps[0]).toBeCloseTo(Date.now(), -2);
  });

  it("handles missing localStorage gracefully", () => {
    localStorageMock.getItem.mockImplementation(() => { throw new Error("no storage"); });
    const result = checkRateLimit();
    expect(result.allowed).toBe(true);
  });
});
