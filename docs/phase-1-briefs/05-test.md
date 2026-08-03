# TERMINAL 5 — TEST

> ⚠️ Bu terminal **To'lqin 3** da ochiladi — BACKEND, INFRA va FRONTEND
> `main` ga merge qilingandan KEYIN. Undan oldin sinaydigan kod yo'q.

## Worktree tayyorlash (asosiy repo'dan)

```bash
git worktree add ../kidir-test -b test/phase-1-coverage main
cd ../kidir-test
npm install
npm run generate --workspace=apps/api
cp ../kidir/.env .env
claude
```

## Prompt (shu matnni Claude'ga ber)

---

Sen Kidir loyihasining TEST terminalisan. Avval `CLAUDE.md`,
`docs/phase-1-briefs/00-umumiy-qoidalar.md` va `.claude/rules/testing.md` ni o'qi.

**Sen FAQAT test fayllariga yozasan:** `**/*.spec.ts` va `apps/api/test/**`.
Ishlab chiqarish kodiga TEGMAYSAN. Testda bug topsang — tuzatma, hisobotga yoz
va ORKESTR ga xabar ber (u BACKEND/INFRA terminaliga topshiradi).

### Kontekst

Faza 1 (auth) yozib bo'lindi. Sening vazifang — test qamrovini talab darajasiga
yetkazish. Framework: Jest (api), Vitest (shared), supertest (e2e).
Prisma **mock qilinmaydi** — test DB ishlatiladi (docker'da ishlab turibdi,
`docker/postgres-init/01-create-test-db.sh` alohida test bazasini yaratadi).

### Talab qilinadigan qamrov

`.claude/rules/testing.md`: auth va state-machine logikasi uchun **100% branch**.

**`apps/api/src/auth/auth.service.spec.ts`** — mavjudini to'ldir:

- refresh rotation: yangi token beriladi, eskisi `revokedAt` bilan yopiladi,
  `replacedById` to'g'ri, `familyId` o'zgarmaydi
- **reuse detection**: revoke qilingan tokenni qayta ishlatish → butun `familyId`
  revoke, `REFRESH_REUSE_DETECTED`
- parallel refresh (poyga holati): ikkita bir vaqtdagi so'rov → bittasi yutadi
- noto'g'ri parol va mavjud bo'lmagan user → **aynan bir xil** `INVALID_CREDENTIALS`
- `SUSPENDED` / `BANNED` user login qila olmaydi
- telefon tasdiqlanmagan `register` → `OTP_NOT_VERIFIED`
- ikki marta bir xil telefon bilan register → `PHONE_ALREADY_REGISTERED`

**`apps/api/src/otp/redis-otp.service.spec.ts`** — to'ldir:

- noto'g'ri kod urinishni kamaytiradi; limitdan keyin `OTP_TOO_MANY_ATTEMPTS`
  va kod Redis'dan **o'chirilgan** (qayta urinib ko'rib bo'lmaydi)
- TTL o'tgan → `OTP_EXPIRED`
- resend oynasi ichida → `OTP_ALREADY_SENT`
- `consumeVerification()` ikki marta → ikkinchisi `false` (replay himoyasi)

**`apps/api/test/auth.e2e-spec.ts`** — supertest bilan, YANGI:

- `POST /auth/login` muvaffaqiyatda `Set-Cookie` da **`HttpOnly`**, **`SameSite=Lax`**
  bor; javob body'sida **token YO'Q**
- `X-Requested-With` headersiz POST → **403 `CSRF_HEADER_MISSING`**
- guard'siz protected endpointga cookie'siz kirish → 401 `UNAUTHORIZED`
- rate limit: 6 ta ketma-ket login urinishi → **429 `RATE_LIMITED`**
- `GET /users/:id` javobida `phone`, `email`, `passwordHash` **yo'q**
- xato javobi doim `{ error: { code, message } }` shaklida

**`packages/shared`** — mavjud 34 test bor; qo'shimcha holat topsang qo'sh.

### Test yozish uslubi

- Nom xatti-harakatni tasvirlaydi: `it("revokes the whole family when a rotated refresh token is replayed")`
- Har test mustaqil — bazani test orasida tozala (`beforeEach`)
- Flaky test yozma: vaqtga bog'liq joyda soatni mock qil, `sleep` ishlatma

### Tugagach

`npm run test` yashil. Coverage hisobotini ko'rsat:
`npm run test --workspace=apps/api -- --coverage`.
Keyin o'zbekcha hisobot: qancha test qo'shildi, qamrov qancha, **qaysi buglar topildi**.

---
