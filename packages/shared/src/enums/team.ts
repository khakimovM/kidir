export const TEAM_STATUSES = ["INCOMPLETE", "ACTIVE", "SUSPENDED"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export const TEAM_MEMBER_ROLES = ["PM", "MEMBER"] as const;
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number];

export const TEAM_MEMBER_STATUSES = ["INVITED", "ACTIVE", "LEFT", "REMOVED"] as const;
export type TeamMemberStatus = (typeof TEAM_MEMBER_STATUSES)[number];
