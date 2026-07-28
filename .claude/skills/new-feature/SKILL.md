---
name: new-feature
description: Yangi feature'ni Kidir arxitekturasiga mos to'liq tartibda yaratadi
argument-hint: [feature tavsifi]
disable-model-invocation: true
---
Yangi feature: $ARGUMENTS

kidir-domain skillini yukla, docs/PLAN.md dagi v1/v2 chegarasini tekshir (v2 narsa bo'lsa OGOHLANTIR).
Tartib (architecture.md):
1. PLAN: fayllar ro'yxati + tegishli domen qoidalari — menga ko'rsat, TASDIQLAT
2. `packages/shared`: zod schema + type + socket event konstantasi (kerak bo'lsa)
3. Prisma schema + ma'noli migratsiya (kerak bo'lsa)
4. API: service (+unit test, o'tmaguncha to'xta) → controller + guards + e2e
5. Web/Admin: api-client → hook → komponent (frontend-design rule)
6. Yakun: `npm run lint && npm run typecheck && npm run test`
Har bosqichdan keyin bir qatorli status.
