---
paths:
  - "apps/api/prisma/**"
  - "apps/api/src/**/repositories/**"
---
# Database Qoidalari (PostgreSQL + Prisma)

- Har model: `id String @id @default(uuid(7))` (UUID v7 — vaqt-tartibli, index-samarali),
  `createdAt`, `updatedAt`. Soft delete kerak bo'lsa `deletedAt`.
- Pul: `BigInt` (tiyin). Statuslar: Prisma `enum`.
- Append-only jadvallar: LedgerEntry, AuditLog, Amendment — UPDATE/DELETE hech qachon.
- Hard-delete taqiqlangan: User, Team, Deal, Milestone, Dispute — faqat status/soft-delete.
- Config jadvali: komissiya %, limitlar, SLA — kod hardcode qilmaydi, shu yerdan o'qiydi (keshlanadi).
- Index: har foreign key + har filter ustuni (`@@index`). N+1 taqiqlangan.
- Migratsiya nomi ma'noli inglizcha snake_case: `add_deal_milestones`.
- Mavjud migratsiya HECH QACHON tahrirlanmaydi — faqat yangi.
- Redis: kalitlar `kidir:<domen>:<id>`, TTL majburiy. Redis'da haqiqat manbai YO'Q (kesh/queue/presence).
