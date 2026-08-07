# Davom ettirish qo'llanmasi

> Ishni to'xtatib, keyinroq (ertaga, bir haftadan keyin) qaytganingizda shu fayldan boshlang.
> Oxirgi yangilanish: 2026-08-07, Faza 1 To'lqin 3 boshlangan holat.

---

## 1. Hozir qayerdamiz

**Faza 1 (auth) — To'lqin 3 (sifat) ketmoqda.**

| Nima            | Holat                                                              |
| --------------- | ------------------------------------------------------------------ |
| Faza 0          | ✅ tugagan (monorepo, prisma, admin, CI)                           |
| Faza 1 poydevor | ✅ shared kontraktlar, common qatlam, modul shell'lari             |
| Faza 1 kod      | ✅ INFRA + BACKEND + FRONTEND yozilgan va `main` ga merge qilingan |
| Faza 1 sifat    | 🔄 **To'lqin 3 ketmoqda** — TEST va AUDIT terminallari ishlayapti  |

`main` = `c0e9b48`, GitHub'da (`origin/main` bilan bir xil).

**Ishlayotgani jonli tekshirilgan:** ro'yxatdan o'tish → SMS OTP → email OTP → login →
refresh rotation → reuse detection → logout. CSRF, rate limit, user enumeration himoyasi,
SSRF allowlist, cookie bayroqlari — hammasi sinovdan o'tgan.

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

Birinchi vazifa: To'lqin 3 ni boshqarish — TEST va AUDIT terminallari ishini
kuzatish, tugagach merge qilish. Menga o'zbek tilida javob ber.

---

---

## 4. To'lqin 3 terminallari (HOZIR ISHLAYAPTI)

Bu ikkitasi **parallel** ishlaydi, bir-biriga tegmaydi.

### TEST terminali — `..\kidir-test`, branch `test/phase-1-coverage`

```bat
cd C:\Users\Aziz\Desktop\kidir
git worktree add ..\kidir-test -b test/phase-1-coverage main
cd ..\kidir-test
npm install
npm run generate --workspace=apps/api
copy ..\kidir\.env .env
claude
```

Prompt: `docs/phase-1-briefs/05-test.md` faylidagi "Prompt" bo'limi.

> Test yurgizish uchun Docker ko'tarilgan bo'lishi SHART (`docker compose up -d`) —
> Prisma mock qilinmaydi, testlar haqiqiy Postgres va Redis'ga boradi.

### AUDIT terminali — `..\kidir-audit`, branch `audit/phase-1`

```bat
cd C:\Users\Aziz\Desktop\kidir
git worktree add ..\kidir-audit -b audit/phase-1 main
cd ..\kidir-audit
claude
```

`npm install` shart emas — bu terminal faqat o'qiydi va hisobot yozadi.

Prompt: `docs/phase-1-briefs/06-audit.md` faylidagi "Prompt" bo'limi.

> **Muhim:** o'tgan safar ikkita terminal ishni **commit qilmay** qoldirgan edi.
> Promptga qo'shimcha qilib ayting: "tugagach ishingni albatta commit qil".

### To'lqin 3 tugagach (ORKESTR qiladi)

1. `test/phase-1-coverage` ni `main` ga merge (faqat spec fayllar — konflikt yo'q).
2. AUDIT hisobotlarini (`docs/reviews/phase-1-*.md`) o'qib, topilmalarni fix
   vazifalariga taqsimlash.
3. Har merge'dan keyin `npm run lint && npm run typecheck && npm run test`,
   so'ng **ilovani haqiqatan ko'tarib ko'rish**.
4. Worktree'larni tozalash (5-bo'lim).

---

## 5. Tugagan worktree'larni tozalash

To'lqin 2 terminallari (backend, infra, frontend) tozalangan — worktree'lari
o'chirilgan, branchlari `main` ga merge bo'lgani uchun olib tashlangan.

To'lqin 3 tugagach xuddi shunday qiling:

```bat
cd C:\Users\Aziz\Desktop\kidir
git worktree remove ..\kidir-test
git worktree remove ..\kidir-audit
git branch -d test/phase-1-coverage audit/phase-1
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
