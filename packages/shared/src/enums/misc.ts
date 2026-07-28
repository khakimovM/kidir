export const RATING_DIRECTIONS = ["CLIENT_TO_TEAM", "TEAM_TO_CLIENT"] as const;
export type RatingDirection = (typeof RATING_DIRECTIONS)[number];
