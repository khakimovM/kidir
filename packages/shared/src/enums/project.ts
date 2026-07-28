export const PROJECT_STATUSES = ["OPEN", "IN_DEAL", "COMPLETED", "CANCELLED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const APPLICATION_STATUSES = ["PENDING", "WITHDRAWN", "ACCEPTED", "DECLINED"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
