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

**GitHub Actions'da `Test` qadami yiqilyapti**, lokalda esa 54/54 test o'tadi.

Lokalda takrorlab bo'lmadi. Chetlab o'tilgan taxminlar:

- seed qilinmagan toza baza — o'tdi
- `NODE_ENV=test` + CI env kalitlari — o'tdi
- turbo keshi maskalayapti — `npm run test -- --force` bilan ham o'tdi
- parallel suitelar xalaqiti — `--maxWorkers=2` bilan o'tdi

Yiqilgan run: https://github.com/khakimovM/kidir/actions/runs/30975007112

CI log'lari `403` qaytaradi (Actions log'lari auth talab qiladi). Davom etish uchun
**xato matni kerak** — uni olishning yo'llari:

```bat
winget install --id GitHub.cli
```

keyin Claude sessiyasida `! gh auth login`, shundan so'ng men log'ni o'zim o'qiy olaman.
Yoki yuqoridagi sahifani ochib `Test` qadamining xatosini menga tashlang.

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
