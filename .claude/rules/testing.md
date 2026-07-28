# Test Qoidalari

- Framework: Vitest (web + shared), Jest (api, NestJS standart). E2E: supertest.
- Fayllar kod yonida: `deal.service.spec.ts`
- Pul/escrow/status-machine logikasi: 100% branch coverage MAJBURIY — bu pul!
- Har bug fix uchun regression test.
- Test nomlari xatti-harakatni tasvirlaydi: `it('rejects 4th active deal for a team')`
- Prisma testlarda mock qilinmaydi — test DB (testcontainers yoki alohida schema).
