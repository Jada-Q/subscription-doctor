const STORAGE_KEY = "subsc-doctor-scans";
const MAX_SCANS_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

interface ScanRecord {
  timestamps: number[];
}

function getRecord(): ScanRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // localStorage unavailable (private mode, etc.)
  }
  return { timestamps: [] };
}

function saveRecord(record: ScanRecord) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Silently fail
  }
}

/**
 * Check if the user can perform another scan.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  const record = getRecord();

  // Remove timestamps older than 1 hour
  record.timestamps = record.timestamps.filter((t) => now - t < HOUR_MS);

  if (record.timestamps.length >= MAX_SCANS_PER_HOUR) {
    const oldest = record.timestamps[0];
    return { allowed: false, retryAfterMs: HOUR_MS - (now - oldest) };
  }

  return { allowed: true };
}

/**
 * Record a scan attempt. Call after successful processing.
 */
export function recordScan() {
  const now = Date.now();
  const record = getRecord();
  record.timestamps = record.timestamps.filter((t) => now - t < HOUR_MS);
  record.timestamps.push(now);
  saveRecord(record);
}
