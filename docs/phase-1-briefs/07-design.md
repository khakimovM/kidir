# TERMINAL 7 — DIZAYN (Faza 1.5)

> Faza 1 tugagach ishlaydi. Bu **yagona** terminal — parallel emas, chunki u
> `apps/web/**` ning katta qismini qayta yozadi va boshqa hech kim u bilan bir
> vaqtda ishlay olmaydi.

## Nima uchun bu faza alohida

Faza 1 da UI **ishlashi** uchun yozilgan: oqim to'g'ri, holatlar to'liq,
accessibility joyida — auditda frontend "toza" deb baholandi. Lekin u
**sotmaydi**. `apps/web/app/page.tsx` ning o'zida shunday deb yozilgan:
`Placeholder home page: the real landing and dashboard arrive in phase 2`.

Kidir'ning asosiy raqibi — Telegram guruhlari, va butun qiymat taklifi bitta
savolda: _"Telegram'da ham topasiz — lekin kim kafolat beradi?"_. Landing shu
savolni bermasa va javob bermasa, qolgan hamma narsa (escrow, milestone,
dispute) ko'rinmay qoladi.

## Hozirgi holat — nima tayyor, nima yo'q

**Tayyor va tegilmaydi (poydevor):**

- `apps/web/app/globals.css` — to'liq token tizimi: `--accent: #c15f3c`
  (terrakota), warm oq fon `#faf9f5`, dark mode, `--surface-sunken`, semantik
  ranglar va ularning `-weak` variantlari `color-mix` bilan hosil qilinadi
  (accent'ni o'zgartirsangiz barcha holatlar birga siljiydi).
- **Tailwind'ning o'z shkalasi butunlay o'chirilgan** (`--color-*: initial`,
  `--text-*: initial`, `--radius-*: initial`). Ya'ni `bg-red-500` yoki
  `text-3xl` yozib bo'lmaydi — kompilyatsiya bo'lmaydi. Shrift shkalasi aynan
  12/14/16/20/28/40/56, radius 8px (control) / 12px (card).
- 12 ta UI primitive: `button`, `card`, `field`, `input`, `textarea`,
  `password-input`, `otp-input`, `radio-card`, `slider`, `alert`, `spinner`.
  Hammasida hover / focus-visible / disabled / loading holatlari bor,
  `Field` esa `aria-describedby`/`aria-invalid` ni avtomatik ulaydi.
- `next/font` bilan Sora (sarlavha) + Inter (matn), global `:focus-visible`
  ring va `prefers-reduced-motion`.

**Yo'q:**

- Landing sahifasi (hozir 25 qatorlik placeholder).
- Sayt karkasi: header, footer, navigatsiya, mobil menyu.
- Faza 2-4 ekranlari uchun dizayn tili: jamoa kartasi, loyiha e'loni,
  deal/milestone timeline, chat, dashboard sidebar.
- Bo'sh holat (empty state), skeleton/loading, xato sahifalari (404/500).

## Qamrov (shu tartibda)

### 1. Landing — asosiy ish

Bitta sahifa, lekin bu fazaning yuragi. Bo'limlar (taxminiy, o'zgartirish
mumkin — asosiysi hikoya):

1. **Hero.** Bitta aniq va'da + ikkita CTA (client uchun "Loyiha e'lon qilish",
   worker uchun "Jamoa tuzish"). Telegram bilan taqqoslash shu yerda
   boshlanadi.
2. **Muammo → yechim.** Telegram'da nima yo'q: kafolat yo'q, kim javobgar
   noma'lum, pul oldindan yoki umuman yo'q. Kidir'da: escrow, PM javobgar,
   milestone bo'yicha to'lov.
3. **Qanday ishlaydi** — 4-5 qadam, client va worker uchun alohida ko'rinish.
4. **Ishonch elementlari.** Escrow qanday ishlashi (pul kimda turadi), dispute
   jarayoni, komissiya ochiq ko'rsatilgan (2% + 2%).
5. **Jamoalar uchun** — nega yakka freelancer emas: PM boshchiligidagi
   tekshirilgan jamoa, SubShartnoma bilan scope creep himoyasi.
6. **FAQ + yakuniy CTA.**

Matn **o'zbek tilida**, ishonchli va ortiqcha va'dasiz. "Eng zo'r platforma"
emas — aniq mexanizm: "pul escrow'da turadi, siz qabul qilmaguningizcha
o'tmaydi".

### 2. Sayt karkasi

Header (logo, navigatsiya, kirish/ro'yxatdan o'tish, mobil menyu), footer
(havolalar, oferta, aloqa), 404 va 500 sahifalari. Bular Faza 2 dan boshlab
har sahifada ishlatiladi.

### 3. Auth oqimini sayqallash

8 ta mavjud sahifa (`kirish`, `royxatdan-otish/*`, `onboarding/*`) ishlaydi —
ularni **buzmang**, faqat vizual jihatdan landing bilan bir tilda qiling:
progress ko'rsatkichi, aniqroq sarlavhalar, bo'sh joy muvozanati.

### 4. Faza 2-4 uchun dizayn tili (kod emas, namunalar)

Keyingi fazalar tez yozilishi uchun oldindan belgilanadigan naqshlar:

- **Jamoa kartasi:** avatar/logo, nom, reyting, a'zolar soni, "yangi jamoa"
  badge (`docs/PLAN.md` 5.1), stack teglari.
- **Loyiha e'loni kartasi:** sarlavha, byudjet (tiyin → so'm formatlash),
  muddat, "X% depozit qo'yilgan" badge (3.5-B), stack teglari.
- **Deal/milestone timeline:** status zanjiri, har milestone'da summa,
  acceptance criteria, muddat va holat rangi.
- **Status badge tizimi:** `docs/PLAN.md` dagi barcha enum'lar uchun izchil
  rang-mantiq (semantik rang + past saturatsiyali fon).
- **Dashboard karkasi:** chap sidebar (profil, loyihalar, jamoalar, xabarlar,
  arizalar, balans) — `.claude/rules/frontend-design.md` da belgilangan.
- **Bo'sh holat va skeleton** naqshlari.

Bularni `apps/web/app/(dev)/dizayn/page.tsx` kabi ichki "dizayn tizimi"
sahifasida ko'rsatish mumkin — keyingi fazalarda nusxa olinadi.

## Fayl egaligi

**Seniki:** `apps/web/**` (barcha sahifalar, komponentlar, `globals.css`).

**Tegmaysan:** `apps/api/**`, `packages/shared/**`, `apps/admin/**`,
`docs/**`, root konfiglar. Agar shared'dan biror narsa kerak bo'lsa (masalan
yangi konstanta), ORKESTR ga ayt — o'zing qo'shma.

## Muhim texnik qoidalar

- **Hardcode rang, shrift o'lchami yoki radius YO'Q.** Hammasi `globals.css`
  tokenlaridan. Yangi token kerak bo'lsa — `globals.css` ga qo'sh, komponentga
  emas. (Tailwind shkalasi o'chirilgani uchun buni "unutib qo'yish" mumkin
  emas, lekin inline `style` bilan chetlab o'tish mumkin — qilmang.)
- **Yangi limit yoki matn konstantasi** `packages/shared` da bo'lishi kerak,
  komponentda emas. Audit aynan shuni topgan (`phase-1-code.md` O-4): hozir
  `MAX_SKILLS`, `MAX_LINKS`, `MAX_BIO` web'da qayta yozilgan. Agar shu
  fayllarga tegsangiz, ORKESTR ga ayting — u shared'ga ko'chiradi.
- Har interaktiv element: hover / focus-visible / disabled / loading.
- Animatsiya: 0.2–0.35s, faqat `transform` va `opacity`,
  `prefers-reduced-motion` hurmat qilinadi.
- Mobil birinchi. Landing telefonda ochilishi asosiy holat.
- Rasm yo'q (Faza 2 gacha fayl yuklash yo'q) — SVG, tipografika va layout bilan
  ishlang.
- Test: `apps/web` da Vitest. Sahifa testlari majburiy emas, lekin murakkab
  komponent (masalan mobil menyu) uchun yozilsa yaxshi.

## Ishga tushirish

```bat
cd C:\Users\Aziz\Desktop\kidir
git worktree add ..\kidir-design -b design/phase-1-5 main
cd ..\kidir-design
npm install
npm run generate --workspace=apps/api
copy ..\kidir\.env .env
claude
```

Ishlatish: `npm run dev --workspace=apps/web` (3000-portda). API kerak
bo'lsa asosiy papkadan `npm run dev --workspace=apps/api` ni ishlatib turing.

## Prompt (shu matnni Claude'ga ber)

---

Sen Kidir loyihasining DIZAYN terminalisan (Faza 1.5). Avval `CLAUDE.md`,
`docs/PLAN.md` (ayniqsa 1-bo'lim: qiymat taklifi), `.claude/rules/frontend-design.md`
va `docs/phase-1-briefs/07-design.md` (to'liq vazifang) ni o'qi.

`frontend-design` skill'ini ishlat.

Qisqacha: sen `apps/web/**` ga egasan, boshqa hech narsaga tegmaysan. Asosiy
ish — **landing sahifasini noldan yozish** (hozirgisi 25 qatorlik
placeholder), keyin sayt karkasi (header/footer/404/500), auth sahifalarini
vizual sayqallash va Faza 2-4 uchun dizayn tilini belgilash.

Dizayn tizimi poydevori TAYYOR va uni buzma: `apps/web/app/globals.css` dagi
tokenlar, 12 ta UI primitive, Sora+Inter shriftlari. Tailwind'ning o'z
shkalasi ataylab o'chirilgan — `bg-red-500` yoki `text-3xl` ishlamaydi, bu
xato emas. Hardcode rang/o'lcham yozma; yangi qiymat kerak bo'lsa
`globals.css` ga token qo'sh.

Kidir'ning hikoyasi: raqib — Telegram guruhlari, javob esa "Telegram'da ham
topasiz — lekin kim kafolat beradi?". Landing shu savolni berib, escrow +
milestone + PM javobgarligi bilan javob berishi kerak. Matn o'zbekcha,
ishonchli, ortiqcha va'dasiz.

MUHIM: har mantiqiy bosqichdan keyin ALBATTA commit qil
(`feat(web): ...` formatida). Ishni bo'laklab bajar — avval landing, keyin
karkas, keyin qolgani — har bo'lakdan keyin `npm run lint && npm run typecheck`
yashil bo'lsin. Tugagach o'zbekcha hisobot ber: nima qilindi, qanday qarorlar
qabul qilindi va nimani ORKESTR hal qilishi kerak.

Menga o'zbek tilida javob ber.

---
