import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Only sample 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // PII scrubbing — never send financial data
  beforeSend(event) {
    // Scrub any amount/price data from error messages
    if (event.message) {
      event.message = event.message
        .replace(/¥[\d,]+/g, "¥[REDACTED]")
        .replace(/\d{4}[\s/-]\d{2}[\s/-]\d{2}/g, "[DATE]");
    }

    // Scrub breadcrumbs of any OCR text or financial data
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((crumb) => {
        if (crumb.data) {
          const cleaned = { ...crumb.data };
          delete cleaned.ocrText;
          delete cleaned.transactions;
          delete cleaned.amount;
          return { ...crumb, data: cleaned };
        }
        return crumb;
      });
    }

    // Remove any extra context that might contain financial data
    if (event.extra) {
      delete event.extra.ocrResult;
      delete event.extra.transactions;
      delete event.extra.matched;
    }

    return event;
  },
});
