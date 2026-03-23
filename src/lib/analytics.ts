/**
 * Lightweight funnel analytics using Sentry custom events.
 * Tracks: page_view → upload → result → share
 *
 * No PII is sent — only event names and aggregate counts.
 */

let sentryLoaded: typeof import("@sentry/nextjs") | null = null;

async function getSentry() {
  if (!sentryLoaded) {
    try {
      sentryLoaded = await import("@sentry/nextjs");
    } catch {
      return null;
    }
  }
  return sentryLoaded;
}

export type FunnelEvent =
  | "page_view"
  | "demo_click"
  | "upload_start"
  | "ocr_complete"
  | "result_view"
  | "share_click"
  | "feedback_submit";

/**
 * Track a funnel event. Safe to call even if Sentry isn't configured.
 */
export async function trackEvent(
  event: FunnelEvent,
  data?: Record<string, string | number | boolean>
) {
  const Sentry = await getSentry();
  if (!Sentry) return;

  Sentry.addBreadcrumb({
    category: "funnel",
    message: event,
    level: "info",
    data,
  });

  // Use captureMessage with a fingerprint so Sentry groups by event type
  Sentry.withScope((scope) => {
    scope.setTag("funnel_event", event);
    scope.setLevel("info");
    scope.setFingerprint(["funnel", event]);
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        scope.setTag(`funnel.${key}`, String(value));
      }
    }
    Sentry.captureMessage(`[funnel] ${event}`);
  });
}
