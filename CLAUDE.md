# Kidir — Jamoaviy Freelance Marketplace (kidir.net)

Upwork'dan farqi: yakka freelancer emas, PM boshchiligidagi JAMOALAR loyiha oladi.
Escrow + milestone'li to'lov + SubShartnoma. TO'LIQ PLAN: @docs/PLAN.md (haqiqat manbai).
Domen qoidalari avtomatik yuklanadi: kidir-domain skill.

## Monorepo (npm workspaces + Turborepo)
- `apps/web` — Next.js 15 App Router (client + worker interfeysi), Tailwind v4, TS strict
- `apps/admin` — Next.js 15 (moderator + superadmin paneli, admin.kidir.net)
- `apps/api` — NestJS, Prisma, PostgreSQL, Redis (BullMQ + pub/sub), Socket.IO
- `packages/shared` — zod schemalar, typelar, konstantalar (UCHCHALA app SHU YERDAN import qiladi)

## Buyruqlar (root'dan, npm!)
- Dev: `npm run dev` (web:3000, admin:3001, api:4000)
- Test: `npm run test` | bitta app: `npm run test --workspace=apps/api`
- Lint + typecheck: `npm run lint && npm run typecheck` (commit oldidan MAJBURIY)
- Migratsiya: `npm run migrate --workspace=apps/api` (prisma migrate dev)
- Prisma client: `npm run generate --workspace=apps/api`

## Qat'iy qoidalar (buzilmaydi)
- Pul FAQAT integer tiyin (`BigInt`). Float bilan pul arifmetikasi TAQIQLANGAN.
- Har balans o'zgarishi `prisma.$transaction` + `LedgerEntry` (double-entry) bilan.
- Barcha id: UUID v7 (`@default(uuid(7))`).
- Auth tokenlar FAQAT httpOnly+Secure+SameSite cookie'da. localStorage'da token YO'Q. CSRF himoya majburiy.
- Tashqi xizmatlar FAQAT interfeys orqali: PaymentProvider (v1: Mock), MailProvider (Gmail SMTP),
  StorageProvider (v2: Multer lokal), LlmProvider (v2: Ollama). Implementatsiya to'g'ridan-to'g'ri import qilinmaydi.
- `any` taqiqlangan. API input FAQAT shared'dagi zod schema bilan validatsiya qilinadi.
- Har endpoint'da JwtGuard + RolesGuard (CLIENT | WORKER | PM | MODERATOR | SUPERADMIN).
- Statuslar Prisma enum; o'tishlar FAQAT state-machine service orqali.
- Biznes limitlar (komissiya %, jamoa/deal limitlari, SLA) hardcode EMAS — DB config jadvalidan.

## Git
- Conventional commits: `feat(api):`, `fix(web):`, `feat(admin):`, `refactor(shared):`
- Branch: `feature/<nom>`, `fix/<nom>`. `main`ga to'g'ridan-to'g'ri push YO'Q.

## Til
Kod, kommentlar, commitlar — inglizcha. Men bilan muloqot — o'zbek tilida.
