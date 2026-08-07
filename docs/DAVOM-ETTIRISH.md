# Davom ettirish qo'llanmasi

> Ishni to'xtatib, keyinroq (ertaga, bir haftadan keyin) qaytganingizda shu fayldan boshlang.
> Oxirgi yangilanish: 2026-08-07, **Faza 1 tugagan**, Faza 1.5 (dizayn) boshlanishga tayyor.

---

## 1. Hozir qayerdamiz

**Faza 1 (auth) TUGADI.** Kod, testlar, audit va audit topilmalarining
YUQORI darajadagilari — hammasi `main` da.

| Nima            | Holat                                                              |
| --------------- | ------------------------------------------------------------------ |
| Faza 0          | ✅ tugagan (monorepo, prisma, admin, CI)                           |
| Faza 1 poydevor | ✅ shared kontraktlar, common qatlam, modul shell'lari             |
| Faza 1 kod      | ✅ INFRA + BACKEND + FRONTEND yozilgan va `main` ga merge qilingan |
| Faza 1 sifat    | ✅ 274 test, xavfsizlik auditi + kod review, YUQORI fixlar         |
| Faza 1.5 dizayn | ⬜ **keyingi qadam** — `docs/phase-1-briefs/07-design.md`          |

**Testlar:** 256 unit + 24 e2e. `npm run test` va `npm run test:e2e` — ikkalasi
ham CI'da ishlaydi.

**Ishlayotgani jonli tekshirilgan:** ro'yxatdan o'tish → SMS OTP → email OTP → login →
refresh rotation → reuse detection → logout. CSRF, rate limit, user enumeration himoyasi,
SSRF allowlist, cookie bayroqlari — hammasi sinovdan o'tgan.

### Audit natijasi (2026-08-07)

To'liq hisobotlar: `docs/reviews/phase-1-security.md`, `docs/reviews/phase-1-code.md`.
Baho 8/10 va 8.5/10, **KRITIK topilma yo'q**.

Tuzatilgan (YUQORI):

- **Guardlar global emas edi** — `@UseGuards` yozishni unutgan har yangi
  controller jimgina ochiq qolardi. Endi `APP_GUARD`, default "yopiq",
  regression testi bilan (`apps/api/test/global-guards.e2e-spec.ts`).
- **Google OAuth `state` brauzerga bog'lanmagan edi** — qurbonni hujumchining
  akkauntiga kiritish mumkin edi. Endi httpOnly cookie bilan juftlanadi.
- **`trust proxy` yo'q edi** — nginx ortida butun platforma bitta 5/min
  chelakni bo'lishardi. Endi `TRUST_PROXY_HOPS` env'dan.
- **`any` taqiqi `apps/web` ga yetib bormasdi** — eslint qoidasi qo'shildi.
- `enableShutdownHooks()` — Redis/Prisma endi toza yopiladi.

⚠️ **Ochiq qolgan, qaror kutmoqda:** `attachPhone` (`auth.service.ts:200`) da
`user.phone === null` sharti yo'q, ya'ni u amalda cheklovsiz telefon-almashtirish
endpointi — parolsiz va eski raqamga xabarsiz. Payout SMS-tasdiqlangan telefonga
bog'langani uchun bu pul kanaliga tegadi (hisobotdagi H-2). Savol: foydalanuvchi
telefonini umuman o'zgartira olishi kerakmi? Yo'q bo'lsa — bir qatorlik fix;
ha bo'lsa — parol tasdiqi bilan alohida oqim (Faza 2).

Qolgan O'RTA/PAST topilmalar hisobotlarda roadmap bo'yicha tartiblangan.

### ✅ Yopilgan: CI `Test` qadamining goh-goh yiqilishi

PR #1 (`fix/ci-test-step`) `main` ga merge qilindi — `c0e9b48`.

2026-08-05 dagi tekshiruv nimani ko'rsatdi:

- Yiqilgani **`apps/api` Jest suite'i** (`packages/shared` vitest emas) — CI annotation'idan:
  `command (.../apps/api) npm run test exited (1)`.
- **Turg'un emas.** `main` da 2/2 yiqildi, **aynan bir xil test kodi** bilan
  `fix/ci-test-step` branch'ida **59/59 o'tdi** (11 ta oddiy run + 48 urinishlik
  matritsa). Ya'ni ayb kod mantiqida emas — vaqt/parallellikda.
- Yiqilgan `Test` qadami har ikkalasida ham **5 soniya**, o'tganida — 3 soniya.
  Demak timeout emas, tez yiqilish.
- Lokalda ketma-ket 10 ta run va 1.5s qattiq timeout bilan ham takrorlanmadi.

Qabul qilingan chora (diagnoz emas, himoya):

1. `Test` qadami chiqishi `$GITHUB_STEP_SUMMARY` ga yoziladi → agar yana yiqilsa,
   log run sahifasida **auth'siz** o'qiladi.
2. `apps/api` testlari `--runInBand` bilan (barcha speclar bitta Postgres/Redis
   ustida raqobatlashmasin) va `testTimeout: 30000` bilan.

> **Diqqat:** `--runInBand` endi majburiy — To'lqin 3 da spec fayllar soni 2 dan
> 16 ga chiqdi va hammasi bitta bazani baham ko'radi. Yangi worktree ochsangiz
> yoki eski branch'da ishlasangiz, `apps/api/package.json` dagi test skripti
> `--runInBand` bilanligiga ishonch hosil qiling.

Eski yiqilgan run'lar (tarix uchun): 30975007112, 30977109697.

### ⚠️ Windows: Smart App Control native modullarni bloklashi mumkin

2026-08-06 da Smart App Control enforcement rejimiga o'tib, `argon2` ning tayyor
binary'sini blokladi. Alomat aldamchi: `npm install` node-gyp bilan manbadan
qurishga o'tadi va **"Python topilmadi"** deb yiqiladi — Python o'rnatish yechim
EMAS. Tekshirish:

```bat
node -e "require('argon2'); console.log('argon2 OK')"
```

`An Application Control policy has blocked this file` chiqsa → Windows Security →
App & browser control → Smart App Control settings → **Off** (bir tomonlama:
qayta yoqish uchun Windows reset kerak).

---

## 2. Har safar ish boshlashdan oldin

```bat
cd C:\Users\Aziz\Desktop\kidir
docker compose up -d
git pull
```

Baza va Redis ko'tarilganini tekshirish: `docker compose ps` — ikkalasi `healthy` bo'lsin.

Uzoq tanaffusdan keyin qo'shimcha:

```bat
npm install
npm run generate --workspace=apps/api
npm run migrate --workspace=apps/api
```

Muammo chiqsa → `docs/SETUP.md` dagi 8-bo'lim (muammolar jadvali).

---

## 3. ORKESTR terminalini ishga tushirish

Bu asosiy terminal — merge, hisobot, umumiy fayllar shu yerda.

```bat
cd C:\Users\Aziz\Desktop\kidir
claude
```

Claude ochilgach quyidagi promptni bering:

---

Sen Kidir loyihasining ORKESTR terminalisan. `docs/DAVOM-ETTIRISH.md` ni o'qi —
u yerda qayerda to'xtaganimiz yozilgan. Keyin `CLAUDE.md`, `docs/PLAN.md` va
`docs/phase-1-briefs/README.md` ni ko'r.

Sening rolingda: `packages/shared/**`, `apps/api/prisma/**`, `app.module.ts`,
`main.ts`, `package.json`, `docs/**` senga tegishli — feature terminallar bularga
tegmaydi. Merge'ni ham sen qilasan.

Birinchi vazifa: Faza 1.5 (dizayn) ni boshlash — `docs/phase-1-briefs/07-design.md`.
Menga o'zbek tilida javob ber.

---

---

## 4. Keyingi qadam — Faza 1.5 (dizayn)

Yakka terminal, parallel emas: u `apps/web/**` ning katta qismini qayta yozadi,
shuning uchun ishlayotganda boshqa hech kim frontend'ga tegmaydi.

```bat
cd C:\Users\Aziz\Desktop\kidir
git worktree add ..\kidir-design -b design/phase-1-5 main
cd ..\kidir-design
npm install
npm run generate --workspace=apps/api
copy ..\kidir\.env .env
claude
```

Prompt: `docs/phase-1-briefs/07-design.md` faylidagi "Prompt" bo'limi.

Asosiy ish — landing sahifasi (hozirgisi 25 qatorlik placeholder), sayt karkasi
va Faza 2-4 ekranlari uchun dizayn tili.

> Dev server: `npm run dev --workspace=apps/web`. Docker ko'tarilgan bo'lsin
> (`docker compose up -d`) — API kerak bo'lganda.

---

## 5. Tugagan worktree'larni tozalash

To'lqin 2 (backend, infra, frontend) va To'lqin 3 (test, audit) terminallari
tozalangan.

Dizayn terminali tugagach xuddi shunday qiling:

```bat
cd C:\Users\Aziz\Desktop\kidir
git worktree remove ..\kidir-design
git branch -d design/phase-1-5
git worktree list
```

---

## 6. Ish tartibi (eslatma)

Har faza uchun bir xil naqsh:

1. **To'lqin 1 — poydevor.** Faqat ORKESTR: shared kontraktlar, modul shell'lari,
   barcha npm paketlar bir marta. `main` ga merge. Boshqa terminal ochilmaydi.
2. **To'lqin 2 — kod.** 3 terminal parallel, fayl egaligi bo'lingan (konflikt nol).
   ORKESTR bog'liqlik yo'nalishi bo'yicha ketma-ket merge qiladi.
3. **To'lqin 3 — sifat.** TEST + AUDIT parallel. AUDIT kod yozmaydi, hisobot yozadi.
   Topilmalarni ORKESTR fix vazifasi qilib taqsimlaydi.

Har merge'dan keyin: `npm run lint && npm run typecheck && npm run test`, so'ng
**ilovani haqiqatan ko'tarib ko'rish** — merge buglari faqat shunda chiqadi
(Faza 1 da aynan shunday bug topildi: `JwtGuard` DI xatosi).

Faza 1 da o'rganilgan ikki narsa:

- **Terminal ish chiqarganini `git log` bilan emas, `git status` bilan ham
  tekshiring.** AUDIT terminali "tugadim" degan holatda hech narsa commit
  qilmagan edi va bu faqat qo'lda tekshirganda ma'lum bo'ldi.
- **`main` yangilangach, ishlayotgan terminallarga rebase qilishni ayting.**
  TEST terminali eski `main` dan olingani uchun `--runInBand` siz ishlagan.

---

## 7. Faza 1 dan keyin nima

`docs/PLAN.md` dagi roadmap bo'yicha:

| Faza | Nima                                                           |
| ---- | -------------------------------------------------------------- |
| 1.5  | **Dizayn** — `frontend-design` skill bilan to'liq sayt dizayni |
| 2    | Jamoa CRUD + taklif, loyiha e'lon + filter, PM ariza, forward  |
| 3    | Chat (Socket.IO + Redis), NotificationService + email          |
| 4 ⚠️ | Deal state machine, milestone, SubShartnoma, ledger, escrow    |

Faza 1.5 (dizayn) — siz aytgan tartib: auth tugagach to'liq dizayn, keyin Faza 2.
