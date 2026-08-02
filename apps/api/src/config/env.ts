import { z } from "zod";
import { loadEnv } from "./load-env";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.url(),
  ADMIN_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  // Auth cookies are httpOnly+Secure+SameSite=Lax; the domain is shared by
  // web and admin so a single session works on both subdomains.
  COOKIE_DOMAIN: z.string().default("localhost"),

  // Provider selection: business code injects the interface, never the
  // implementation. v1 ships mock SMS (no Eskiz account yet).
  SMS_PROVIDER: z.enum(["mock", "eskiz"]).default("mock"),
  MAIL_PROVIDER: z.enum(["mock", "gmail"]).default("mock"),

  ESKIZ_EMAIL: z.string().optional(),
  ESKIZ_PASSWORD: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.url().optional(),
});

// A provider selected without its credentials fails at first use, deep
// inside a request. Catch it at boot instead.
const requiredWhenSelected = {
  eskiz: ["ESKIZ_EMAIL", "ESKIZ_PASSWORD"],
  gmail: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"],
} as const;

const fullEnvSchema = envSchema.superRefine((value, ctx) => {
  const selected = [
    value.SMS_PROVIDER === "eskiz" ? requiredWhenSelected.eskiz : [],
    value.MAIL_PROVIDER === "gmail" ? requiredWhenSelected.gmail : [],
  ].flat();

  for (const key of selected) {
    if (value[key] === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `${key} is required when the matching provider is enabled`,
      });
    }
  }
});

export type Env = z.infer<typeof fullEnvSchema>;

export const env: Env = fullEnvSchema.parse(process.env);
