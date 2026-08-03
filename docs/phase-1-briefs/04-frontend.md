# TERMINAL 4 — FRONTEND (web auth UI)

## Worktree tayyorlash (asosiy repo'dan)

Windows `cmd.exe` da:

```bat
cd C:\Users\Aziz\Desktop\kidir
git worktree add ..\kidir-frontend -b feature/phase-1-web-auth-ui main
cd ..\kidir-frontend
npm install
npm run generate --workspace=apps/api
copy ..\kidir\.env .env
claude
```

PowerShell'da oxirgi ikki qatordan biri farq qiladi: `Copy-Item ..\kidir\.env .env`

## Prompt (shu matnni Claude'ga ber)

---

Sen Kidir loyihasining FRONTEND terminalisan. Avval `CLAUDE.md`,
`docs/PLAN.md`, `docs/phase-1-briefs/00-umumiy-qoidalar.md` va
`.claude/rules/frontend-design.md` ni o'qi.

**Sen FAQAT `apps/web/**` ichiga yozasan.** `apps/api`, `packages/shared`,
`apps/admin` — TEGMAYSAN.

Backend parallel yozilayapti. Sen `@kidir/shared` dagi zod kontraktlarga tayanasan —
ular allaqachon tayyor va o'zgarmaydi. Backend hali javob bermasa, UI kontraktga
qarab qurilsin (mock data bilan sinasang bo'ladi).

### Vazifa 1 — API client (`apps/web/lib/api-client/`)

`fetch` ustida yupqa wrapper:

- **`credentials: "include"`** — tokenlar httpOnly cookie'da, JS ularni ko'rmaydi.
- **Har mutation (POST/PUT/PATCH/DELETE) da `X-Requested-With: XMLHttpRequest`**
  header — bu CSRF himoyasi, serverda majburiy.
- **localStorage/sessionStorage'da token SAQLANMAYDI.** Umuman token bilan
  ishlamaysan — brauzer cookie'ni o'zi yuboradi.
- Xato javobi doim `{ error: { code, message } }` — `ApiError` klassiga aylantir,
  `code` ni `ERROR_CODES` bilan solishtirish mumkin bo'lsin.
- 401 kelganda bir marta `/auth/refresh` ga urinib, so'rovni qayta yubor;
  yana 401 bo'lsa — kirish sahifasiga. **Cheksiz sikl bo'lmasin.**
- Base URL `process.env.NEXT_PUBLIC_API_URL` dan (default `http://localhost:4000`).

### Vazifa 2 — UI primitivlari (`apps/web/components/ui/`)

`.claude/rules/frontend-design.md` — o'qi va **qat'iy amal qil**:

- Ranglar FAQAT CSS o'zgaruvchilardan (`var(--accent)` va h.k.).
  **Hardcode hex TAQIQLANGAN.** Tokenlar `apps/web/app/globals.css` da tayyor.
- Tipografika: Sora (sarlavha, 600, letter-spacing -0.02em), Inter (matn, line-height 1.6).
  Shkala: 12/14/16/20/28/40/56 — boshqa o'lcham YO'Q.
- Spacing 4px shkalasi: 4,8,12,16,24,32,48,64.
- Radius: 8px (button/input), 12px (card). Border `1px solid rgba(0,0,0,0.08)`.
- ❌ gradientlar, glassmorphism, shishirilgan shadow, 16px+ radius.
- **Har interaktiv element:** hover, focus-visible, disabled, loading holatlari.

Komponentlar: `Button` (variant: primary/secondary/ghost), `Input`, `Field`
(label+error+hint), `Card`, `OtpInput` (6 katak, paste qo'llab-quvvatlaydi,
avtomatik keyingi katakka o'tadi), `Spinner`, `Alert`.

Sora va Inter shriftlarini `next/font/google` orqali ulash kerak (hozir faqat
CSS o'zgaruvchida nom bor, shrift yuklanmagan) — `apps/web/app/layout.tsx` senga tegishli.

### Vazifa 3 — Auth sahifalari (`apps/web/app/(auth)/`)

Oqim (`docs/PLAN.md` "Onboarding" bo'limi):

1. `/kirish` — telefon yoki email + parol. Google bilan kirish tugmasi (faqat client).
2. `/royxatdan-otish` — rol tanlash (CLIENT / WORKER) → telefon kiritish
3. `/royxatdan-otish/telefon-tasdiq` — OTP (6 katak), qayta yuborish taymeri,
   qolgan urinishlar ko'rsatiladi
4. `/royxatdan-otish/malumot` — email, parol, to'liq ism
5. `/onboarding/email-tasdiq` — email OTP
6. `/onboarding/soha` — WORKER uchun: mutaxassislik tanlash
7. `/onboarding/stacklar` — skill'lar 0-100 slider. **UI'da aniq yozilsin:
   "o'z bahosi" (self-assessment)** — platforma buni tekshirmaydi.
8. `/onboarding/portfolio` — bio (ixtiyoriy) + link'lar.
   Ruxsat etilgan saytlar ro'yxati ko'rsatilsin, `isAllowedPortfolioUrl`
   (shared'da tayyor) bilan **client tomonda ham** tekshir.

Validatsiya `@kidir/shared` schemalari bilan (`zRegister`, `zLogin`, `zOtpCode`, ...) —
o'z validatsiyangni YOZMA, dublikat type TAQIQLANGAN.

Xato xabarlari o'zbekcha va aniq: `ERROR_CODES` ga qarab matn tanlansin
(masalan `OTP_TOO_MANY_ATTEMPTS` → "Urinishlar tugadi, yangi kod so'rang").

### Chegaralar (v1 da YO'Q)

Avatar/banner yuklash, fayl yuklash, GitHub OAuth — bularni **taklif qilma**, v2.

### Tugagach

`npm run lint && npm run typecheck && npm run build` — uchalasi yashil.
`npm run dev --workspace=apps/web` bilan sahifalarni brauzerda ko'rib chiq.
Keyin o'zbekcha qisqa hisobot yoz va ORKESTR ga xabar ber.

---
