export const ACCOUNT_TYPES = ["USER", "ESCROW", "PLATFORM_COMMISSION", "EXTERNAL"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const LEDGER_REASONS = [
  "DEPOSIT",
  "WITHDRAWAL",
  "DEAL_HOLD",
  "AMENDMENT_HOLD",
  "MILESTONE_PAYOUT",
  "COMMISSION_CLIENT",
  "COMMISSION_WORKER",
  "DISPUTE_REFUND",
  "DISPUTE_PAYOUT",
  "DISPUTE_SPLIT",
  "DEAL_CANCEL_REFUND",
  "ADJUSTMENT",
] as const;
export type LedgerReason = (typeof LEDGER_REASONS)[number];
