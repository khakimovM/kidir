---
name: kidir-domain
description: Kidir platformasining domen qoidalari - rollar, deal va milestone hayotiy tsikli, SubShartnoma, escrow, dispute taksonomiyasi, jamoa qoidalari. Deal, escrow, milestone, subshartnoma, jamoa, loyiha, ariza, balans, komissiya, reyting bilan bog'liq HAR QANDAY ishda ishlatiladi.
user-invocable: false
---

# Kidir Domen Qoidalari (docs/PLAN.md bilan sinxron)

## Rollar

CLIENT (loyiha e'lon qiladi, deal tuzadi, to'laydi) · WORKER (mutaxassis, jamoa a'zosi) ·
PM (worker'ning maxsus turi: FAQAT PM client bilan gaplashadi va deal tuzadi) ·
MODERATOR (disputelar, flaglar; vaqtincha suspend; doimiy ban — superadmin tasdig'i) ·
SUPERADMIN (analitika, moderator CRUD, global config).

## Jamoa

- Minimal tarkib: PM + backend + frontend YOKI PM + fullstack. To'lmaguncha INCOMPLETE (ariza berolmaydi).
- Jamoada aynan 1 PM. PM aktiv deal borida jamoadan chiqa olmaydi.
- Worker maks 3 jamoada; PM'lik faqat 1 jamoada. Limitlar DB config'dan (obuna oshiradi).
- Jamoada bir vaqtda MAKS 3 aktiv deal — server tomonda enforce.
- Yangi jamoa: birinchi 2 deal'da "yangi jamoa" badge.

## Loyiha → Deal oqimi

Client e'lon (OPEN; SMS-verified; ixtiyoriy depozit → e'londa "X% depozit qo'yilgan" badge)
→ PM ariza (narx + xat) → chat → Client DEAL yaratadi (summa tiyin, milestonelar 1-5,
acceptance criteria, deadline) → PM qabul YOKI izoh bilan rad (client tahrirlaydi; counter-offer v2)
→ ACCEPTED: summa hold'ga → PM taqsimot (kim nima, kim qancha) → HAR a'zo tasdiqlaydi →
taqsimot deal'ga IMMUTABLE biriktiriladi → IN_PROGRESS.
Boshqa workerlar loyihani chatga forward qiladi (faqat PM ariza beradi).

## Milestone hayotiy tsikli (har biri alohida!)

PENDING → IN_PROGRESS → DELIVERED (PM topshirdi) → COMPLETED (client qabul) | DISPUTED

- DELIVERED'dan keyin client 5 KUN javob bermasa → avto-COMPLETED + to'lov (BullMQ job).
- Deadline: 80%da ogohlantirish → o'tsa 48h grace → avto-DISPUTE (reject EMAS).
- Uzaytirish: PM so'raydi → client tasdiqlaydi.
- COMPLETED milestone puli darhol taqsimot bo'yicha to'lanadi (har worker'dan 2% komissiya).

## SubShartnoma (Change Order / Amendment)

Client loyiha davomida qo'shimcha ish so'rasa: PM SubShartnoma yuboradi (client EMAS) —
qo'shimcha narx (tiyin) + umumiy deadline'ga qo'shimcha kunlar + acceptance criteria.
Oqim: PROPOSED → client ACCEPTED | DECLINED.

- ACCEPTED'da: qo'shimcha summa DARHOL client balansidan hold'ga (yetmasa tasdiqlash bloklanadi);
  komissiya 2%+2% bu summaga ham alohida.
- Texnik model: deal'ga YANGI milestone(lar) qo'shiladi + deadline siljiydi — topshirish/qabul/
  dispute mexanikasi o'zgarishsiz ishlaydi.
- PM qo'shimcha taqsimot yuboradi → ta'sirlangan a'zolar tasdiqlaydi (asosiy taqsimot immutable qoladi).
- Faqat deal IN_PROGRESS'da. Tasdiqlanmaguncha PM qo'shimcha ishni boshlamaydi.
- 3-aktiv-deal limitiga KIRMAYDI. Har SubShartnoma o'chirilmas Amendment yozuvi sifatida deal tarixida.
- D5 (scope creep) nizosining konstruktiv yechimi shu.

## Pul oqimi (escrow)

1. Client balans to'ldiradi (2% komissiya) — v1'da MockPaymentProvider (fake), interfeys:
   hold()/capture()/refund(). Real: Payme/Click/Uzum (hold provayder tomonida), keyin ichki escrow.
2. Deal ACCEPTED → summa client balansidan HOLD'ga. SubShartnoma ACCEPTED → qo'shimcha summa ham.
3. Milestone COMPLETED → o'sha milestone summasi jamoaga taqsimot bo'yicha.
4. DISPUTED → tegishli milestone puli muzlaydi (boshqalari davom etadi) →
   moderator qarori: refund | payout | SPLIT (foizli).

- HAR harakat = LedgerEntry (double-entry, append-only). Idempotency key majburiy.

## Dispute taksonomiyasi

D1 client: criteria'ga mos emas → refund/payout/split · D2 avto/client: deadline (48h grace'dan
keyin) · D3 client: jamoa ghosting → bekor+refund+warning · D4 PM: client asossiz rad →
payout/split · D5 PM: scope creep → criteria'ga qaytarish yoki SubShartnoma taklifi ·
D6 a'zo: haqim berilmadi → immutable taqsimot bo'yicha majburiy payout, PM warning ·
D7 har kim: haqorat → warning/suspend · D8 har kim: firibgarlik → suspend + superadmin eskalatsiya.
Oqim: OPEN→UNDER_REVIEW→NEED_INFO→RESOLVED. SLA: 3 ish kuni. Qaror asosi min 100 belgi,
ledger+audit log'ga. Dispute'da chatlar moderator uchun read-only. Apellyatsiya v2.

## Reyting

Client↔jamoa, faqat COMPLETED deal'dan keyin, 1-5+izoh. Ikkala tomon baholagach YOKI 14 kunda
ochiladi (qasos-baho himoyasi). Jamoa reytingi = o'rtacha. Individual reyting v2.

## Onboarding

Worker: bosqichli — telefon(SMS OTP Eskiz) → email(OTP Gmail SMTP) → full name → soha →
stacklar (0-100 self-assessment, UI'da "o'z bahosi") → bio(opt) → CV/portfolio link
(FAQAT allowlist: github/gitlab/linkedin/behance/dribbble/notion). Avatar/banner — v2.
Client: telefon+email+parol+full name yoki Google OAuth. kycLevel: NONE|PHONE|FULL.

## v1'da YO'Q (taklif qilma, v2 deb belgila)

Fayl yuklash (avatar/banner/TZ rasm/chat fayl), video/audio qo'ng'iroq, GitHub OAuth,
top-jamoalar algoritmi, obuna, skill-testlar, MyID, AI yordamchi, counter-offer, apellyatsiya,
individual reyting. v1 chat FAQAT matn.
