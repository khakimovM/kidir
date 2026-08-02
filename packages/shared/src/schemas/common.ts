import { z } from "zod";

export const zMoneyTiyin = z.bigint().nonnegative();

export const zUuid = z.uuid();

export const zCursor = z.uuid();

export const zPhone = z
  .string()
  .regex(/^\+998\d{9}$/, "Telefon raqam +998XXXXXXXXX formatida bo'lishi kerak");

export const zPagination = z.object({
  cursor: zCursor.optional(),
  limit: z.number().int().positive().max(100).default(20),
});

export type Pagination = z.infer<typeof zPagination>;
