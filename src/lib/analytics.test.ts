import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent } from "./analytics";

// Mock @sentry/nextjs dynamic import
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: vi.fn(),
  withScope: vi.fn((cb: (scope: Record<string, unknown>) => void) => {
    cb({
      setTag: vi.fn(),
      setLevel: vi.fn(),
      setFingerprint: vi.fn(),
    });
  }),
  captureMessage: vi.fn(),
}));

describe("trackEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not throw when called with valid event", async () => {
    await expect(trackEvent("page_view")).resolves.toBeUndefined();
  });

  it("does not throw when called with event data", async () => {
    await expect(
      trackEvent("ocr_complete", { duration: 1200, confidence: 0.96 })
    ).resolves.toBeUndefined();
  });

  it("calls Sentry.addBreadcrumb with correct category", async () => {
    const Sentry = await import("@sentry/nextjs");
    await trackEvent("upload_start");
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "funnel",
        message: "upload_start",
        level: "info",
      })
    );
  });

  it("calls Sentry.captureMessage with event name", async () => {
    const Sentry = await import("@sentry/nextjs");
    await trackEvent("share_click");
    expect(Sentry.captureMessage).toHaveBeenCalledWith("[funnel] share_click");
  });
});

describe("trackEvent without Sentry", () => {
  it("does not throw when Sentry import fails", async () => {
    // Reset module to clear cached Sentry
    vi.resetModules();
    vi.doMock("@sentry/nextjs", () => {
      throw new Error("Module not found");
    });
    const { trackEvent: trackNoSentry } = await import("./analytics");
    await expect(trackNoSentry("page_view")).resolves.toBeUndefined();
  });
});
