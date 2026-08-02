# Kidir — Rasmiy Loyiha Plani (v1.1)

> Haqiqat manbai. Barcha qarorlar Aziz tomonidan tasdiqlangan (2026-07).
> O'zgartirishda: shu fayl + `.claude/skills/kidir-domain/SKILL.md` sinxronlanadi.

## 1. Qisqacha

Kidir (kidir.net) — O'zbekiston uchun jamoaviy freelance marketplace. Yakka freelancer emas,
PM boshchiligidagi tekshirilgan JAMOALAR loyiha oladi. Qiymat: escrow pul kafolati +
milestone'li topshirish + yagona muloqot nuqtasi (PM) + nizo hal qilish.
Asosiy raqib: Telegram guruhlari. Javob: "Telegram'da topasiz — lekin kim kafolat beradi?"

## 2. Tasdiqlangan qarorlar jurnali

### 1-blok: Pul va biznes model

- **1.1 Escrow:** v1'da `MockPaymentProvider` (fake to'lov, to'liq oqim simulyatsiyasi).
  Kod boshidan `PaymentProvider` interfeysiga: `hold() / capture() / refund()`.
  Real provayderlar: Payme, Click, Uzum (hold provayder/bank tomonida). So'nggi bosqichda
  to'liq ichki escrow'ga o'tish (kod o'zgarmaydi, provayder almashadi).
- **1.2 Komissiya:** 2% client + 2% worker. Keyinchalik premium obuna (jamoada `plan` maydoni,
  limitlar DB config'dan — hardcode emas).

### 2-blok: MVP chegarasi

- **v1:** auth+onboarding (SMS OTP Eskiz + email OTP Gmail SMTP + Google OAuth), jamoa tuzish,
  loyiha e'lon+qidiruv+forward, matnli chat (guruh + PM↔Client), deal + yengil milestone (1-5),
  SubShartnoma, escrow (mock), reyting, dispute + moderator paneli, superadmin minimal, landing,
  in-app+email notification.
- **v1.5:** Telegram-bot notification.
- **v2:** barcha fayl yuklash (avatar/banner/TZ rasm/chat fayl — Multer lokal, `StorageProvider`
  interfeysi, keyin cloud), video/audio qo'ng'iroq, GitHub OAuth, top-jamoalar algoritmi,
  premium obuna, skill-testlar, MyID KYC, AI yordamchi, apellyatsiya, counter-offer.
- **2.1 Milestone:** deal ixtiyoriy 1-5 bosqichga bo'linadi; har birida: summa (tiyin),
  acceptance criteria, muddat. Har biri alohida DELIVERED→COMPLETED va alohida to'lanadi.

### 3-blok: Domen modeli

- **3.1 Jamoa:** har worker jamoa yarata oladi; PM tayinlanib minimal tarkib
  (PM+backend+frontend YOKI PM+fullstack) to'lmaguncha INCOMPLETE (ariza bera olmaydi).
  Jamoada aynan 1 PM. PM aktiv deal borida chiqa olmaydi.
- **3.2 Loyiha→Deal:** Client e'lon (OPEN) → PM ariza (narx+xat) → chat → Client DEAL yaratadi
  (summa, milestonelar, criteria, deadline) → PM qabul / izoh bilan rad (client tahrirlaydi;
  counter-offer v2) → ACCEPTED: hold → PM taqsimot → HAR a'zo tasdiqlaydi → IN_PROGRESS.
  Boshqa workerlar loyihani chatga forward qiladi.
- **3.3 Himoya:** milestone DELIVERED → client 5 kunda qabul/dispute, javobsiz = avto-COMPLETED
  - to'lov. Deadline: 80%da ogohlantirish → o'tsa 48h grace → avto-DISPUTE (reject emas).
    Uzaytirish: PM so'raydi, client tasdiqlaydi.
- **3.4 Reyting:** client↔jamoa, faqat COMPLETED deal'dan keyin, 1-5+izoh, ikkala tomon
  baholagach yoki 14 kunda ochiladi (qasos-baho himoyasi). Jamoa reytingi = o'rtacha. Individual — v2.
- **3.5-A:** Worker maks 3 jamoada; PM'lik faqat 1 jamoada (limitlar config'da, obuna oshiradi).
- **3.5-B:** SMS verifikatsiya hammaga majburiy. Depozit IXTIYORIY trust-signal: client qo'ysa
  e'londa "X% depozit qo'yilgan" badge chiqadi.
- **3.6 SubShartnoma (Change Order):** Client loyiha davomida qo'shimcha ish so'rasa,
  PM SubShartnoma yuboradi (client EMAS): qo'shimcha narx + umumiy deadline'ga qo'shimcha kunlar +
  acceptance criteria. Client tasdiqlaydi. Tasdiqda: qo'shimcha summa darhol hold'ga (balans
  yetmasa tasdiqlash bloklanadi), komissiya 2%+2% SubShartnoma summasiga ham. Texnik model:
  deal'ga yangi milestone(lar) qo'shiladi + deadline siljiydi. PM qo'shimcha taqsimot yuboradi,
  ta'sirlangan a'zolar tasdiqlaydi (asosiy taqsimot immutable qoladi). Faqat IN_PROGRESS'da;
  3-deal limitiga KIRMAYDI; o'chirilmas Amendment yozuvi sifatida deal tarixida.
  Oqim: PROPOSED → ACCEPTED | DECLINED. Tasdiqlanmaguncha PM qo'shimcha ishni boshlamaydi.
  D5 (scope creep) ning konstruktiv yechimi shu.

### 4-blok: Texnik arxitektura

- **4.1 Chat:** Socket.IO + Redis adapter. Xabarlar PostgreSQL'da (haqiqat manbai), Redis faqat
  pub/sub+presence+typing. Universal `Conversation` (PM_CLIENT | TEAM | DISPUTE) + participants.
  Read receipt: oxirgi o'qilgan xabar id. Dispute'da chat moderator uchun read-only ochiladi.
  Telefon raqamlar deal imzolanmaguncha chatda maskalanadi.
- **4.2 Notification:** yagona NotificationService: DB (in-app) → socket push → BullMQ → email.
  Kanallar plagin (inApp, email; v1.5 telegram). SMS OTP: Eskiz.uz. Email: Gmail SMTP
  (`MailProvider` interfeysi, keyin almashadi).
- **4.3 Lokalizatsiya:** UZ fuqarolari shaxsiy ma'lumotlari UZ serverlarida (qonun talabi,
  yurist bilan aniqlanadi).
- **4.4 Infra:** UZ VPS, Docker Compose (postgres+redis+api+web+admin). MinIO v1'da YO'Q
  (fayllar v2'da Multer lokal). CI/CD: GitHub Actions. Sentry + UptimeRobot + pino.
  Qidiruv: Postgres full-text (Meilisearch v2). k8s YO'Q.

### 5-blok: Xavfsizlik

- **5.1 Anti-fraud:** komissiya = soxta deal narxi; bir xil telefon/karta/fingerprint
  client↔worker juftliklari avtomatik flag → moderator; yangi jamoa birinchi 2 deal'da
  "yangi jamoa" badge.
- **5.2 Pul:** o'chirilmas audit log (har moderator/superadmin harakati); kunlik pg backup +
  haftalik offsite; payout: SMS-tasdiqlangan telefon + karta egasi ismi = profil ismi. 2FA v2.
- **5.3 KYC:** v1 yengil (SMS+email), `User.kycLevel: NONE|PHONE|FULL` boshidan schemada.
  MyID — v2 yoki provayder talab qilsa.

### 6-blok: Qo'shimcha qarorlar

- **6.1:** v1 to'lov fake (Mock). ⚠️ 6.5-faza: beta'dan oldin kamida 1 real provayder.
- **6.2:** Email OTP Gmail SMTP (v1-v2).
- **6.3:** Fayl yuklash to'liq v2 (Multer lokal + StorageProvider). v1 chat faqat matn.
- **6.4:** AI yordamchi (Ollama+Qwen, UZ server, GPU kerak bo'ladi) — v2. Arxitektura printsipi
  HOZIRDAN: AI bazaga to'g'ridan-to'g'ri kirmaydi; tool-call'lar service qatlamidan so'rovchi
  userning JWT/roli bilan o'tadi (RolesGuard birdek ishlaydi). `LlmProvider` interfeysi.
  Rol-bazali promptlar: client=TZ yordamchi, worker=maslahatchi, moderator=dispute-tahlilchi
  (hisobot beradi, QAROR moderatorda), superadmin=data-tahlilchi. SSE streaming.

### 7-blok: Stack qarorlari

- **7.1:** npm (workspaces). pnpm EMAS.
- **7.2:** 3 app: `apps/web` (client+worker, Next.js), `apps/admin` (moderator+superadmin,
  Next.js, admin.kidir.net), `apps/api` (NestJS). + `packages/shared`.
- **7.3:** Auth tokenlar httpOnly+Secure+SameSite cookie'larda (localStorage YO'Q).
  CSRF himoya MAJBURIY: SameSite=Lax + mutation'larda custom header.
- **7.4:** Prisma ORM, barcha id = UUID v7 (`@default(uuid(7))`).

## 3. Dispute taksonomiyasi (D1-D8)

| Kod                                                                                          | Kim         | Holat                                | Qarorlar                                      |
| -------------------------------------------------------------------------------------------- | ----------- | ------------------------------------ | --------------------------------------------- |
| D1                                                                                           | Client      | Milestone criteria'ga mos emas       | refund / payout / SPLIT (foizli)              |
| D2                                                                                           | Avto/Client | Deadline o'tdi (48h grace'dan keyin) | split / refund / muddat                       |
| D3                                                                                           | Client      | Jamoa ghosting                       | bekor + refund + warning                      |
| D4                                                                                           | PM          | Client asossiz rad                   | payout / split                                |
| D5                                                                                           | PM          | Scope creep                          | criteria'ga qaytarish / SubShartnoma taklifi  |
| D6                                                                                           | A'zo        | Ichki: haqim berilmadi               | taqsimot bo'yicha majburiy payout, PM warning |
| D7                                                                                           | Har kim     | Haqorat/nomaqbul xatti-harakat       | warning / suspend                             |
| D8                                                                                           | Har kim     | Firibgarlik/fake shubha              | suspend + superadmin eskalatsiya              |
| Qoidalar: dispute'da tegishli milestone puli muzlaydi (boshqalari davom etishi mumkin);      |
| chatlar read-only dalil; har qaror asos matni (min 100 belgi) bilan ledger+audit log'ga;     |
| oqim: OPEN→UNDER_REVIEW→NEED_INFO→RESOLVED; SLA: birinchi javob 3 ish kuni; apellyatsiya v2. |

## 4. Panellar

**Moderator (apps/admin):** Arizalar inbox (filter, SLA), ariza sahifasi (deal+criteria+
read-only chat+tarix+NEED_INFO+qaror formasi refund/payout/split-slider+asos), flaglar navbati,
userlar read-only + vaqtincha SUSPEND (doimiy ban faqat superadmin tasdig'i — ikki kalit),
o'z statistikasi. Ko'rmaydi: balans operatsiyalari, to'liq to'lov rekvizitlari.
**Superadmin (apps/admin):** ro'yxatlar+qidiruv, moderator CRUD, 6 metrika kartasi (userlar,
aktiv deallar, escrow summasi, komissiya, ochiq disputelar, haftalik loyihalar), audit log,
global config jadvali (komissiya %, limitlar, SLA — DB'da). v2: grafikli analitika, AI-tahlilchi.

## 5. Roadmap

| Faza | Nima                                                                                              | Vaqt                |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------- |
| 0    | Monorepo skelet (npm ws), docker-compose, CI, shared, bazaviy Prisma, design tokenlar             | 1 hafta             |
| 1    | SMS+email OTP, Google OAuth, onboarding, profillar                                                | 1-2 hafta           |
| 2    | Jamoa CRUD+taklif, loyiha e'lon+filter+depozit-badge, PM ariza, forward                           | 2 hafta             |
| 3    | Chat (Socket.IO+Redis), NotificationService+email                                                 | 2 hafta             |
| 4 ⚠️ | Deal state machine, milestone, SubShartnoma, taqsimot, ledger+balans, MockProvider, BullMQ joblar | 3-4 hafta           |
| 5    | Dispute oqimi, moderator paneli, audit log, superadmin minimal                                    | 1-2 hafta           |
| 6    | Reyting, top-jamoalar sort, landing final, Sentry, backup                                         | 1-2 hafta           |
| 6.5  | Kamida 1 REAL to'lov provayderi integratsiyasi                                                    | provayderga bog'liq |
| 7    | Yopiq beta: 10-15 jamoa (Mars IT), 5-10 loyiha concierge                                          | davomiy             |

Parallel action-itemlar (1-fazadan): provayder muzokarasi (hold muddati!), yurist (escrow+
lokalizatsiya+oferta), Eskiz akkaunt, UZ VPS+DNS, IT Park rezidentligi.

## 6. Baho va risklar (2026-07)

Umumiy: 72/100. Texnik amalga oshish ~85-90%. Beta ~65-70%. 12 oyda tirik marketplace ~30-35%
(eng katta filtr: DEMAND). Richaglar: (1) kod oldidan 20 client suhbati, (2) chuqur concierge
beta, (3) hamkor, (4) provayder+yurist erta, (5) building-in-public YouTube.
