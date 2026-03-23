import type { PaymentMethod } from "../data/templates";

const OWNED_KEY = "payment-owned-ids";
const CUSTOM_KEY = "payment-custom-methods";

export function loadOwnedIds(): string[] {
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function saveOwnedIds(ids: string[]): void {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota errors
  }
}

export function loadCustomMethods(): PaymentMethod[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function saveCustomMethods(methods: PaymentMethod[]): void {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(methods));
  } catch {
    // ignore
  }
}
