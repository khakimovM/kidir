# TERMINAL 6 — SECURITY + CODE REVIEW

> ⚠️ Bu terminal **To'lqin 3** da ochiladi — kod `main` ga merge qilingandan KEYIN.
> Bu terminal **KOD YOZMAYDI**, faqat hisobot yozadi.

## Worktree tayyorlash (asosiy repo'dan)

```bash
git worktree add ../kidir-audit -b audit/phase-1 main
cd ../kidir-audit
claude
```

`npm install` shart emas — faqat o'qiydi. (Agar lint yurgizmoqchi bo'lsang — qil.)

## Prompt (shu matnni Claude'ga ber)

---

Sen Kidir loyihasining SECURITY + CODE REVIEW terminalisan. Avval `CLAUDE.md`,
`docs/PLAN.md`, `docs/phase-1-briefs/00-umumiy-qoidalar.md` va butun
`.claude/rules/**` ni o'qi.

**Sen KOD YOZMAYSAN.** Faqat `docs/reviews/` ga hisobot yozasan. Bug topsang —
tuzatma, hisobotga aniq fayl:qator va tavsiya bilan yoz.

Kidir — **pul bilan ishlaydigan** platforma. Faza 1 (auth) uning kirish eshigi.

### 1-qism — Xavfsizlik auditi

`security-auditor` agentini ishga tushir (Agent tool, `subagent_type: "security-auditor"`),
unga aniq doira ber: `apps/api/src/auth/**`, `apps/api/src/common/guards/**`,
`apps/api/src/otp/**`, `apps/api/src/providers/**`, `apps/web/lib/api-client/**`.

Natijani o'zing ham tekshirib chiq. Quyidagilarni **majburiy** ko'r:

**Token va sessiya**

- Access/refresh **faqat** httpOnly + Secure + SameSite cookie'dami?
  localStorage/sessionStorage'da token bormi? (`grep -r "localStorage" apps/web`)
- Javob body'sida token sizib chiqmayaptimi?
- DB'da xom refresh token saqlanmayaptimi (faqat hash bo'lishi kerak)?
- Reuse detection haqiqatan butun `familyId` ni revoke qiladimi?
- Rotation `$transaction` ichidami (poyga holati)?

**CSRF**

- `CsrfGuard` GLOBAL ro'yxatdan o'tganmi, yoki uni unutish mumkinmi?
- GET/HEAD/OPTIONS'dan tashqari HAMMA mutation tekshiriladimi?
- CORS `origin` aniq ro'yxatmi ("\*" emas), `credentials: true` bilan birga?

**OTP**

- Kod kriptografik random'mi (`Math.random` EMAS)?
- Solishtirish doimiy vaqtdami (`timingSafeEqual`)?
- Urinishlar tugagach kod Redis'dan o'chiriladimi (brute-force)?
- `consumeVerification` atomikmi (`GETDEL`/Lua) — replay mumkinmi?
- Kod log'ga yozilib qolmayaptimi (Mock provayderdan tashqari)?
- Har Redis kalitida TTL bormi?

**Auth logikasi**

- User enumeration: mavjud bo'lmagan user va noto'g'ri parol **bir xil** javob beradimi?
- Timing attack: user topilmasa ham argon2 verify chaqiriladimi?
- Parol argon2id'mi (bcrypt/sha emas)?
- Rate limit auth endpointlarida bormi (5/min)?
- Google OAuth: `state` generatsiya + validatsiya + **bir marta ishlatish** bormi?
  Faqat CLIENT roli uchunmi?

**Ma'lumot sizishi**

- `passwordHash`, `googleId`, `tokenHash` javobda chiqmayaptimi?
- `GET /users/:id` da telefon/email chiqmayaptimi?
- Xato xabarlarida stack trace / SQL / ichki yo'llar bormi?
  (`DomainExceptionFilter` noma'lum xatoni umumiy 500 ga aylantirishi kerak)
- Secretlar kodda hardcode qilinganmi? (`grep -rn "secret\|password\|token" --include=*.ts`)

Natija → **`docs/reviews/phase-1-security.md`**. Har topilma:
`Jiddiylik (KRITIK/YUQORI/O'RTA/PAST)` · `fayl:qator` · `nima bo'lishi mumkin` ·
`tavsiya`. Topilma yo'q bo'lsa — shuni ham yoz.

### 2-qism — Kod review

`code-reviewer` agentini ishga tushir (`subagent_type: "code-reviewer"`).
Tekshiriladigan:

- `.claude/rules/**` ga muvofiqlik (arxitektura qatlamlari, API dizayni, DB qoidalari)
- `any` ishlatilganmi? (`grep -rn ": any\|as any" --include=*.ts apps packages`)
- Controller'da biznes logika bormi? (bo'lmasligi kerak)
- Dublikat type — `packages/shared` dagi kontrakt qayta yozilganmi?
- Xom `HttpException` / `throw new Error()` bormi? (faqat `DomainException`)
- Prisma N+1 so'rovlar
- Guard'siz protected endpoint
- Frontend: hardcode hex rang, `.claude/rules/frontend-design.md` buzilishi,
  interaktiv elementda hover/focus-visible/disabled/loading holatlari yo'qligi
- Test qamrovi: auth/OTP uchun 100% branch talabi bajarilganmi

Natija → **`docs/reviews/phase-1-code.md`**, xuddi shu formatda.

### Tugagach

Ikki hisobotni commit qil (`docs: add phase 1 security and code review`).
Keyin o'zbekcha xulosa yoz: **eng jiddiy 3 ta topilma** va umumiy baho.
ORKESTR ga xabar ber — u tuzatishlarni BACKEND/INFRA/FRONTEND ga taqsimlaydi.

---
