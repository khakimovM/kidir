export const DISPUTE_TYPES = [
  "D1_CRITERIA_MISMATCH",
  "D2_DEADLINE_MISSED",
  "D3_TEAM_GHOSTING",
  "D4_UNJUST_REJECTION",
  "D5_SCOPE_CREEP",
  "D6_INTERNAL_PAYOUT_DISPUTE",
  "D7_ABUSE",
  "D8_FRAUD",
] as const;
export type DisputeType = (typeof DISPUTE_TYPES)[number];

export const DISPUTE_STATUSES = ["OPEN", "UNDER_REVIEW", "NEED_INFO", "RESOLVED"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const DISPUTE_RESOLUTIONS = [
  "REFUND",
  "PAYOUT",
  "SPLIT",
  "CANCEL_AND_REFUND",
  "WARNING",
  "SUSPEND",
  "ESCALATED",
] as const;
export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number];
