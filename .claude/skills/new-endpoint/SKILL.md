---
name: new-endpoint
description: NestJS'da yangi endpoint yaratadi (guard, zod DTO, test bilan)
argument-hint: [METHOD /yol — tavsif]
disable-model-invocation: true
---

Endpoint: $ARGUMENTS

Majburiy checklist:

- [ ] Shared zod schema → nestjs-zod DTO
- [ ] JwtGuard + RolesGuard (qaysi rollar? kidir-domain'dan tekshir)
- [ ] Biznes logika service'da, controller yupqa
- [ ] Xato kodlari SCREAMING_SNAKE formatda
- [ ] Pul/status tegsa: $transaction + LedgerEntry + state-machine orqali
- [ ] Unit test (service) + e2e test (controller)
