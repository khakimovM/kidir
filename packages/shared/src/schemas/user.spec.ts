import { describe, expect, it } from "vitest";
import { isAllowedPortfolioUrl, zPortfolioLinks, zSkills } from "./user";

describe("isAllowedPortfolioUrl", () => {
  it("accepts an allowlisted host over https", () => {
    expect(isAllowedPortfolioUrl("https://github.com/aziz")).toBe(true);
  });

  it("accepts a subdomain of an allowlisted host", () => {
    expect(isAllowedPortfolioUrl("https://workspace.notion.site/cv")).toBe(true);
  });

  it("rejects http", () => {
    expect(isAllowedPortfolioUrl("http://github.com/aziz")).toBe(false);
  });

  it("rejects a host outside the allowlist", () => {
    expect(isAllowedPortfolioUrl("https://evil.example.com")).toBe(false);
  });

  it("rejects a host that merely ends with an allowlisted name", () => {
    expect(isAllowedPortfolioUrl("https://notgithub.com/aziz")).toBe(false);
  });

  it("rejects an allowlisted host smuggled into the userinfo part", () => {
    expect(isAllowedPortfolioUrl("https://github.com@evil.example.com/x")).toBe(false);
  });

  it("rejects non-http schemes", () => {
    expect(isAllowedPortfolioUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedPortfolioUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects a malformed url", () => {
    expect(isAllowedPortfolioUrl("not a url")).toBe(false);
  });
});

describe("zPortfolioLinks", () => {
  it("rejects the whole list when one link is not allowlisted", () => {
    const result = zPortfolioLinks.safeParse([
      "https://github.com/aziz",
      "https://evil.example.com",
    ]);
    expect(result.success).toBe(false);
  });

  it("caps the list at 10 links", () => {
    const links = Array.from({ length: 11 }, (_, i) => `https://github.com/user${i}`);
    expect(zPortfolioLinks.safeParse(links).success).toBe(false);
  });
});

describe("zSkills", () => {
  it("accepts a self-assessment inside 0-100", () => {
    expect(zSkills.safeParse([{ name: "NestJS", level: 0 }]).success).toBe(true);
    expect(zSkills.safeParse([{ name: "NestJS", level: 100 }]).success).toBe(true);
  });

  it("rejects a level above 100", () => {
    expect(zSkills.safeParse([{ name: "NestJS", level: 101 }]).success).toBe(false);
  });

  it("rejects a fractional level", () => {
    expect(zSkills.safeParse([{ name: "NestJS", level: 50.5 }]).success).toBe(false);
  });
});
