---
paths:
  - "apps/api/**/*.ts"
---
# API Qoidalari (NestJS)

- Endpoint: REST, plural nouns — `POST /deals`, `GET /projects/:id/applications`
- DTO'lar shared zod schemadan: `createZodDto(CreateDealSchema)` (nestjs-zod)
- Xato formati bir xil: `{ error: { code: "DEAL_LIMIT_EXCEEDED", message } }` — code SCREAMING_SNAKE, exception filter orqali
- Har status o'tishi state-machine service orqali: masalan DealService.transition(dealId, event) —
  noto'g'ri o'tish domain exception tashlaydi
- Pagination: cursor-based (`?cursor=&limit=`), offset emas
- Har service metodi uchun unit test, har controller uchun kamida bitta e2e test
- Socket eventlar nomi: `chat:message`, `deal:updated`, `notification:new` — shared'dagi konstantadan
