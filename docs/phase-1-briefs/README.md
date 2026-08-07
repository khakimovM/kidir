# Faza 1 — Parallel ish briflari

Faza 1 (auth + onboarding + profillar) **3 to'lqinda** bajariladi.
Har brif ichida: worktree yaratish buyrug'i + Claude'ga beriladigan tayyor prompt.

## To'lqin 1 — poydevor ✅ BAJARILDI

ORKESTR yolg'iz ishladi: `packages/shared` kontraktlari, `common/` qatlami,
terminallararo interfeyslar, modul shell'lari, barcha npm paketlar.
`main` ga merge qilindi — qolgan hamma worktree **shu commit'dan** ochiladi.

## To'lqin 2 — kod yozish (3 terminal PARALLEL)

| Brif                             | Terminal | Branch                        |
| -------------------------------- | -------- | ----------------------------- |
| [02-backend.md](02-backend.md)   | BACKEND  | `feature/phase-1-auth-core`   |
| [03-infra.md](03-infra.md)       | INFRA    | `feature/phase-1-providers`   |
| [04-frontend.md](04-frontend.md) | FRONTEND | `feature/phase-1-web-auth-ui` |

Uchalasi bir vaqtda ishlaydi, bir-birining fayliga tegmaydi.
Tugagach ORKESTR ketma-ket merge qiladi: **INFRA → BACKEND → FRONTEND**.

## To'lqin 3 — sifat ✅ BAJARILDI

| Brif                       | Terminal        | Branch                  | Natija                              |
| -------------------------- | --------------- | ----------------------- | ----------------------------------- |
| [05-test.md](05-test.md)   | TEST            | `test/phase-1-coverage` | ✅ 274 test (54 dan), merge qilindi |
| [06-audit.md](06-audit.md) | SECURITY+REVIEW | `audit/phase-1`         | ⚠️ terminal ish chiqarmadi          |

AUDIT terminali hech narsa commit qilmagani uchun auditni ORKESTR o'zi qayta
o'tkazdi — natija: `docs/reviews/phase-1-security.md` va `phase-1-code.md`.
KRITIK topilma yo'q; YUQORI darajadagilar tuzatilgan (guardlar global,
OAuth `state` brauzerga bog'langan, `trust proxy`, web'da `any` taqiqi).

## Faza 1.5 — dizayn (1 terminal, YAKKA)

| Brif                         | Terminal | Branch             |
| ---------------------------- | -------- | ------------------ |
| [07-design.md](07-design.md) | DIZAYN   | `design/phase-1-5` |

Parallel emas: `apps/web/**` ning katta qismini qayta yozadi, shuning uchun
u ishlayotganda boshqa hech kim frontend'ga tegmaydi.

---

## Hamma uchun majburiy

[00-umumiy-qoidalar.md](00-umumiy-qoidalar.md) — egalik chegaralari, texnik
qoidalar, commit formati. Har terminal ishni shu fayldan boshlaydi.

## Ish tugagach worktree'ni tozalash

```bash
git worktree remove ../kidir-backend
git worktree list          # qolganini tekshirish
```
