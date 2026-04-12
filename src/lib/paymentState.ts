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

// Merchant info
export const MERCHANT_INFO = {
  merchantName: "TokenStore",
  merchantId: "TKSTORE001",
  upiHandle: "tokenstore@upi",
};

// Transaction history (in-memory, persisted via localStorage)
const TXN_KEY = "tokenstore_transactions";
const BAL_KEY = "tokenstore_balance";

const loadBalance = (): number => {
  try { return Number(localStorage.getItem(BAL_KEY)) || 0; } catch { return 0; }
};
const loadTransactions = (): PaymentTransaction[] => {
  try { return JSON.parse(localStorage.getItem(TXN_KEY) || "[]"); } catch { return []; }
};

let _balance = loadBalance();
let _transactions = loadTransactions();
const _listeners = new Set<(bal: number) => void>();

export const tokenBalance = {
  get: () => _balance,
  add: (tokens: number) => {
    _balance += tokens;
    localStorage.setItem(BAL_KEY, String(_balance));
    _listeners.forEach((fn) => fn(_balance));
  },
  subscribe: (fn: (bal: number) => void) => {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  },
};

export const transactionStore = {
  getAll: () => _transactions,
  add: (txn: PaymentTransaction) => {
    _transactions = [txn, ..._transactions];
    localStorage.setItem(TXN_KEY, JSON.stringify(_transactions));
  },
};
