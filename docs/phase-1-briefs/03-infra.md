# TERMINAL 3 — INFRA / PROVIDER

## Worktree tayyorlash (asosiy repo'dan)

Windows `cmd.exe` da:

```bat
cd C:\Users\Aziz\Desktop\kidir
git worktree add ..\kidir-infra -b feature/phase-1-providers main
cd ..\kidir-infra
npm install
npm run generate --workspace=apps/api
copy ..\kidir\.env .env
claude
```

PowerShell'da oxirgi ikki qatordan biri farq qiladi: `Copy-Item ..\kidir\.env .env`

## Prompt (shu matnni Claude'ga ber)

---

Sen Kidir loyihasining INFRA/PROVIDER terminalisan. Avval `CLAUDE.md`,
`docs/PLAN.md`, `docs/phase-1-briefs/00-umumiy-qoidalar.md` va
`.claude/rules/security.md` ni o'qi.

**Sen FAQAT shu papkalarga yozasan:**
`apps/api/src/providers/**`, `apps/api/src/redis/**`, `apps/api/src/otp/**`

Boshqa hech qaysi faylga tegmaysan. `packages/shared` va `apps/api/package.json`
allaqachon tayyor — kerakli paketlar (`ioredis`, `nodemailer`) o'rnatilgan.

### Vazifa 1 — RedisModule

`apps/api/src/redis/redis.module.ts` hozir bo'sh shell. To'ldir:

- `REDIS_CLIENT` tokenini provide va export qil (token va `redisKey()` helper
  `redis.constants.ts` da tayyor).
- ioredis instance `env.REDIS_URL` dan quriladi.
- `OnApplicationShutdown` da ulanish yopiladi.
- Modul allaqachon `@Global()` — `app.module.ts` ga tegma.
- Ulanish xatosini log qil, lekin ilovani yiqitma (Redis kesh, haqiqat manbai emas).

### Vazifa 2 — Provayderlar

`apps/api/src/providers/` da interfeyslar TAYYOR — ularni o'zgartirma, implement qil:

- `sms/sms-provider.interface.ts` → `SmsProvider`, `SMS_PROVIDER` token
- `mail/mail-provider.interface.ts` → `MailProvider`, `MAIL_PROVIDER` token

Yozadiganing:

- `sms/mock-sms.provider.ts` — xabarni Nest `Logger` orqali chiqaradi
  (lokal ishlab chiqishda OTP kodi shu yerdan o'qiladi). **Production'da
  ishlatilsa ogohlantirish log qilsin.**
- `sms/eskiz-sms.provider.ts` — Eskiz.uz REST integratsiyasi. Akkaunt hali yo'q,
  shuning uchun: to'liq yozilsin (token olish + refresh, `POST /message/sms/send`),
  lekin sinab bo'lmasligini kod izohida ayt. `env.ESKIZ_EMAIL/PASSWORD` ishlatiladi.
- `mail/mock-mail.provider.ts` — log'ga yozadi.
- `mail/gmail-smtp-mail.provider.ts` — nodemailer, `env.SMTP_*` dan. Transport
  bir marta quriladi (har xabarda emas).
- `providers.module.ts` — `env.SMS_PROVIDER` / `env.MAIL_PROVIDER` qiymatiga qarab
  implementatsiyani `useClass` bilan tanlaydi va **tokenlarni export qiladi**.
  Modul `@Global()` — `app.module.ts` ga tegma.

Muhim: biznes kod hech qachon implementatsiyani import qilmaydi, faqat tokenni inject qiladi.

### Vazifa 3 — OtpService (ENG MUHIM)

`apps/api/src/otp/otp.contract.ts` da abstract class TAYYOR — **shu kontraktni
o'zgartirmasdan** implement qil (`apps/api/src/otp/redis-otp.service.ts`).
BACKEND terminal ayni shu kontraktga tayanib parallel ishlayapti.

Talablar (`docs/PLAN.md` + `.claude/rules/security.md`):

- Kod: **6 raqam**, kriptografik random (`crypto.randomInt`), leading zero saqlanadi.
- Redis kalitlari: `kidir:otp:<channel>:<target>` (`redisKey()` helper bilan).
- TTL va urinishlar soni **hardcode EMAS** — `Config` jadvalidan o'qiladi:
  `CONFIG_KEYS.OTP_TTL_SECONDS` (120), `CONFIG_KEYS.OTP_MAX_ATTEMPTS` (3).
  Konfigni keshla (masalan 60s), har OTP'da DB'ga bormasin.
- `issue()`: resend oynasi ichida qayta so'ralsa → `OTP_ALREADY_SENT` (`DomainException`).
  Kodni tegishli provayder orqali yuboradi (phone → SMS, email → Mail).
- `verify()`: har urinish hisoblanadi. Noto'g'ri → `OTP_INVALID`; muddat o'tgan/yo'q →
  `OTP_EXPIRED`; urinishlar tugagan → `OTP_TOO_MANY_ATTEMPTS` va kod **darhol o'chiriladi**.
  Muvaffaqiyatda kod o'chadi va qisqa muddatli "verified" marker qo'yiladi
  (`kidir:otp:verified:<channel>:<target>`, TTL ~15 daqiqa).
- `consumeVerification()`: markerni **atomik** oladi (Redis `GETDEL` yoki Lua) —
  bitta verifikatsiya ikki marta ishlatilmasin.
- Kodni solishtirish **doim doimiy vaqtda** (`crypto.timingSafeEqual`).
- Kod hech qachon log'ga yozilmaydi (Mock provayderdan tashqari — u ataylab yozadi).
- `otp.module.ts`: `{ provide: OtpService, useClass: RedisOtpService }` + `exports: [OtpService]`.

### Testlar (MAJBURIY)

`apps/api/src/otp/redis-otp.service.spec.ts` — bu xavfsizlik logikasi,
**100% branch coverage**:

- to'g'ri kod → o'tadi, marker qo'yiladi
- noto'g'ri kod → `OTP_INVALID`, urinish kamayadi
- 3-urinishdan keyin → `OTP_TOO_MANY_ATTEMPTS`, kod o'chirilgan
- TTL o'tgan → `OTP_EXPIRED`
- resend oynasi ichida qayta `issue()` → `OTP_ALREADY_SENT`
- `consumeVerification()` ikki marta → ikkinchisi `false`

Redis'ni haqiqiy test instance'da sina (docker'da ishlab turibdi) yoki
`ioredis-mock` ishlat — Prisma esa `Config` uchun mock qilinmaydi, test DB ishlatiladi.

### Tugagach

`npm run lint && npm run typecheck && npm run test` — uchalasi yashil.
Keyin o'zbekcha qisqa hisobot yoz va ORKESTR ga xabar ber.

---
