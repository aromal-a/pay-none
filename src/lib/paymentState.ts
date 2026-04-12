// Common payment variables shared across components

export interface PaymentTransaction {
  id: string;
  amount: number;
  tokens: number;
  status: "pending" | "awaiting_confirmation" | "confirmed" | "failed";
  payMethod: string;
  payTo: string;
  timestamp: number;
  gst: number;
  subtotal: number;
}

export type PaymentStatus = PaymentTransaction["status"];

// Simulated receiver confirmation delay (3-6s in real app, gateway webhook)
export const RECEIVER_CONFIRM_DELAY = 4000;

export const generateTxnId = () =>
  `TXN${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

// In-memory store (replace with DB in production)
let _balance = 0;
const _listeners = new Set<(bal: number) => void>();

export const tokenBalance = {
  get: () => _balance,
  add: (tokens: number) => {
    _balance += tokens;
    _listeners.forEach((fn) => fn(_balance));
  },
  subscribe: (fn: (bal: number) => void) => {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};
