# Davom ettirish qo'llanmasi

> Ishni to'xtatib, keyinroq (ertaga, bir haftadan keyin) qaytganingizda shu fayldan boshlang.
> Oxirgi yangilanish: 2026-08-05, Faza 1 To'lqin 2 tugagan holat.

---

## 1. Hozir qayerdamiz

**Faza 1 (auth) — To'lqin 2 tugadi.** Kod yozilgan, merge qilingan, lokalda ishlaydi.

| Nima            | Holat                                                              |
| --------------- | ------------------------------------------------------------------ |
| Faza 0          | ✅ tugagan (monorepo, prisma, admin, CI)                           |
| Faza 1 poydevor | ✅ shared kontraktlar, common qatlam, modul shell'lari             |
| Faza 1 kod      | ✅ INFRA + BACKEND + FRONTEND yozilgan va `main` ga merge qilingan |
| Faza 1 sifat    | ⬜ **To'lqin 3 boshlanmagan** — TEST va AUDIT terminallari         |

`main` = `fff3fc6`, GitHub'da (`origin/main` bilan bir xil).

**Ishlayotgani jonli tekshirilgan:** ro'yxatdan o'tish → SMS OTP → email OTP → login →
refresh rotation → reuse detection → logout. CSRF, rate limit, user enumeration himoyasi,
SSRF allowlist, cookie bayroqlari — hammasi sinovdan o'tgan.

### ⚠️ Ochiq muammo (birinchi navbatda shu)

**GitHub Actions'da `Test` qadami goh-goh yiqilyapti**, lokalda esa 54/54 test o'tadi.
Tayyor branch: `fix/ci-test-step` (PR ochilishi kerak).

2026-08-05 dagi tekshiruv nimani ko'rsatdi:

- Yiqilgani **`apps/api` Jest suite'i** (`packages/shared` vitest emas) — CI annotation'idan:
  `command (.../apps/api) npm run test exited (1)`.
- **Turg'un emas.** `main` da 2/2 yiqildi, **aynan bir xil test kodi** bilan
  `fix/ci-test-step` branch'ida **59/59 o'tdi** (11 ta oddiy run + 48 urinishlik
  matritsa). Ya'ni ayb kod mantiqida emas — vaqt/parallellikda.
- Yiqilgan `Test` qadami har ikkalasida ham **5 soniya**, o'tganida — 3 soniya.
  Demak timeout emas, tez yiqilish.
- Chetlab o'tilgan taxminlar: `packages/shared/dist`, CI env kalitlari,
  Postgres/Redis versiyalari (ikkalasida ham `17-alpine` / `7-alpine`),
  `kidir_test` bazasi (hech qayerda ishlatilmaydi), seed bog'liqligi
  (OTP spec config qatorlarini o'zi yozadi).
- Lokalda ketma-ket 10 ta run va 1.5s qattiq timeout bilan ham takrorlanmadi.

**Aniq sabab hali noma'lum — log matni kerak.** Actions log'lari public repo'da ham
auth so'raydi (`403`). Shuning uchun `fix/ci-test-step` da:

1. `Test` qadami chiqishi `$GITHUB_STEP_SUMMARY` ga yoziladi → keyingi yiqilish
   run sahifasida **auth'siz** o'qiladi.
2. `apps/api` testlari `--runInBand` bilan (ikkala spec bitta Postgres/Redis ustida
   raqobatlashmasin) va `testTimeout: 30000` bilan — bu **himoya chorasi, diagnoz emas**.

Log'ni to'g'ridan-to'g'ri o'qish uchun (tavsiya):

```bat
winget install --id GitHub.cli
```

keyin Claude sessiyasida `! gh auth login` → `gh run view <run-id> --log-failed`.

Yiqilgan run'lar: 30975007112, 30977109697.

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

Birinchi vazifa: CI'dagi `Test` qadami nega yiqilayotganini aniqlash
(`docs/DAVOM-ETTIRISH.md` dagi "Ochiq muammo" bo'limi). Keyin To'lqin 3 ni
boshlaymiz. Menga o'zbek tilida javob ber.

---

---

## 4. To'lqin 3 terminallarini ishga tushirish

Bu ikkitasi **parallel** ishlaydi, bir-biriga tegmaydi.

### TEST terminali

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

### AUDIT terminali (xavfsizlik + code review)

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

---

## 5. Tugagan worktree'larni tozalash

To'lqin 2 terminallari (backend, infra, frontend) ishini tugatgan va merge qilingan —
ularni o'chirsa bo'ladi:

```bat
cd C:\Users\Aziz\Desktop\kidir
git worktree remove ..\kidir-backend
git worktree remove ..\kidir-infra
git worktree remove ..\kidir-frontend
git worktree list
```

Branchlar `main` ga merge qilingani uchun ularni ham o'chirish mumkin:

```bat
git branch -d feature/phase-1-auth-core feature/phase-1-providers feature/phase-1-web-auth-ui
git branch -d feature/phase-0-skeleton feature/phase-1-foundation
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
