export const DEAL_STATUSES = [
  "PROPOSED",
  "DECLINED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const MILESTONE_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "DELIVERED",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const AMENDMENT_STATUSES = ["PROPOSED", "ACCEPTED", "DECLINED"] as const;
export type AmendmentStatus = (typeof AMENDMENT_STATUSES)[number];

export const DISTRIBUTION_STATUSES = ["PENDING", "ACTIVE", "REJECTED"] as const;
export type DistributionStatus = (typeof DISTRIBUTION_STATUSES)[number];
