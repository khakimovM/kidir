export const CONFIG_KEYS = {
  COMMISSION_CLIENT_BPS: "commission.client.bps",
  COMMISSION_WORKER_BPS: "commission.worker.bps",
  TEAM_MAX_ACTIVE_DEALS: "team.maxActiveDeals",
  WORKER_MAX_TEAMS: "worker.maxTeams",
  PM_MAX_TEAMS: "pm.maxTeams",
  MILESTONE_MIN_COUNT: "milestone.minCount",
  MILESTONE_MAX_COUNT: "milestone.maxCount",
  MILESTONE_AUTO_COMPLETE_DAYS: "milestone.autoCompleteDays",
  DEADLINE_WARN_AT_PCT: "deadline.warnAtPct",
  DEADLINE_GRACE_HOURS: "deadline.graceHours",
  RATING_REVEAL_DAYS: "rating.revealDays",
  DISPUTE_FIRST_RESPONSE_BUSINESS_DAYS: "dispute.firstResponseBusinessDays",
  TEAM_NEW_BADGE_DEALS: "team.newBadgeDeals",
  OTP_TTL_SECONDS: "otp.ttlSeconds",
  OTP_MAX_ATTEMPTS: "otp.maxAttempts",
  AUTH_RATE_LIMIT_PER_MIN: "auth.rateLimitPerMin",
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];
