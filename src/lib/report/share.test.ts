import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Report } from "./types";

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    score: 75,
    grade: "yellow",
    totalMonthly: 5000,
    totalAnnual: 60000,
    allTransactions: [],
    appleTaxItems: [],
    appleTaxTotal: 0,
    overlaps: [],
    savingsMonthly: 500,
    savingsAnnual: 6000,
    matchedCount: 3,
    unmatchedCount: 1,
    totalCount: 4,
    ...overrides,
  };
}

// Set up a minimal document mock for Node environment
const fillTextCalls: string[] = [];
const mockCtx = {
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 0,
  font: "",
  textAlign: "",
  textBaseline: "",
  beginPath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  fillText: vi.fn((text: string) => fillTextCalls.push(text)),
};

const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => mockCtx),
  toDataURL: vi.fn(() => "data:image/png;base64,mockdata"),
};

// Provide globalThis.document.createElement
if (typeof globalThis.document === "undefined") {
  Object.defineProperty(globalThis, "document", {
    value: {
      createElement: vi.fn(() => mockCanvas),
    },
    configurable: true,
  });
} else {
  vi.spyOn(document, "createElement").mockImplementation(
    () => mockCanvas as unknown as HTMLElement
  );
}

describe("generateShareCard", () => {
  beforeEach(() => {
    fillTextCalls.length = 0;
    mockCanvas.width = 0;
    mockCanvas.height = 0;
    vi.clearAllMocks();
    // Re-wire createElement after clearAllMocks
    if (typeof document !== "undefined" && document.createElement) {
      (document.createElement as ReturnType<typeof vi.fn>).mockReturnValue(mockCanvas);
    }
  });

  it("returns a valid data URL", async () => {
    const { generateShareCard } = await import("./share");
    const result = generateShareCard(makeReport());
    expect(result).toMatch(/^data:image\/png/);
  });

  it("sets canvas to 1200x630 dimensions", async () => {
    const { generateShareCard } = await import("./share");
    generateShareCard(makeReport());
    expect(mockCanvas.width).toBe(1200);
    expect(mockCanvas.height).toBe(630);
  });

  it("renders green grade without errors", async () => {
    const { generateShareCard } = await import("./share");
    expect(() =>
      generateShareCard(makeReport({ grade: "green", score: 95 }))
    ).not.toThrow();
  });

  it("renders red grade without errors", async () => {
    const { generateShareCard } = await import("./share");
    expect(() =>
      generateShareCard(makeReport({ grade: "red", score: 30 }))
    ).not.toThrow();
  });

  it("handles zero savings", async () => {
    const { generateShareCard } = await import("./share");
    generateShareCard(makeReport({ savingsAnnual: 0 }));
    const hasOptimized = fillTextCalls.some((c) => c.includes("最適化されています"));
    expect(hasOptimized).toBe(true);
  });

  it("shows savings amount when positive", async () => {
    const { generateShareCard } = await import("./share");
    generateShareCard(makeReport({ savingsAnnual: 12000 }));
    const hasSavings = fillTextCalls.some((c) => c.includes("節約"));
    expect(hasSavings).toBe(true);
  });

  it("handles report with zero services", async () => {
    const { generateShareCard } = await import("./share");
    expect(() =>
      generateShareCard(makeReport({ totalCount: 0, matchedCount: 0 }))
    ).not.toThrow();
  });
});
