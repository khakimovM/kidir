export const PORTFOLIO_ALLOWLIST_DOMAINS = [
  "github.com",
  "gitlab.com",
  "linkedin.com",
  "behance.net",
  "dribbble.com",
  "notion.site",
] as const;

export type PortfolioAllowlistDomain = (typeof PORTFOLIO_ALLOWLIST_DOMAINS)[number];
