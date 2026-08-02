# Arxitektura Qoidalari

## Qatlamlar (dependency faqat pastga)

Web/Admin: `app/` (route) → `components/` → `hooks/` → `lib/api-client/`
API: Controller → Service → Repository (Prisma). Controller'da biznes logika YO'Q.

## Uch app printsipi

- `apps/web` — client + worker. Admin kodi bu bundle'ga HECH QACHON kirmaydi.
- `apps/admin` — moderator + superadmin (alohida deploy, admin.kidir.net).
- Ikkalasi ham bitta `apps/api` bilan gaplashadi; admin endpointlar `/admin/*` prefiksda,
  MODERATOR/SUPERADMIN guard bilan.

## Umumiy

- Kontraktlar FAQAT `packages/shared`da: zod schema + undan chiqarilgan type. Duplikat type TAQIQLANGAN.
- Har NestJS moduli o'z papkasida: controller, service, module, dto, events.
- Modullar aro chaqiruv faqat service orqali.
- Tashqi xizmatlar provider-interfeys pattern bilan (`providers/` papkada):
  PaymentProvider(Mock→Payme/Click/Uzum), MailProvider(GmailSmtp), StorageProvider(v2 MulterLocal),
  LlmProvider(v2 Ollama). Biznes kod interfeysni injectsiya qiladi, implementatsiyani BILMAYDI.
- Real-time: Socket.IO gateway'lar `apps/api/src/gateways/`, Redis adapter bilan.
- Fon ishlari (deadline 80% ogohlantirish, 48h grace, 5-kun avto-complete, email):
  BullMQ, `apps/api/src/jobs/`.
- AI (v2) uchun tayyor turish: AI tool'lari service qatlamidan so'rovchi user JWT/roli bilan
  o'tadi — hech qanday to'g'ridan-to'g'ri DB kirish yo'li qoldirilmaydi.

## Yangi feature tartibi (buzilmaydi)

1. `packages/shared` da zod schema + type
2. Prisma schema (kerak bo'lsa) + migratsiya
3. API: service + unit test → controller + guard
4. Web/Admin: api-client → hook → komponent
   "Avval UI keyin backend" ISHLAMAYDI.
