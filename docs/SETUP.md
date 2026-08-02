# Kidir — Lokal O'rnatish Yo'riqnomasi

Bu hujjat loyihani noldan ishga tushirish va tashqi xizmatlarni (Gmail SMTP, Google OAuth,
Eskiz SMS) ulash bo'yicha bosqichma-bosqich qo'llanma.

---

## 1. Talablar

| Nima           | Versiya | Tekshirish         |
| -------------- | ------- | ------------------ |
| Node.js        | 22+     | `node --version`   |
| npm            | 11+     | `npm --version`    |
| Docker Desktop | oxirgi  | `docker --version` |
| Git            | oxirgi  | `git --version`    |

---

## 2. Birinchi ishga tushirish (5 qadam)

```bash
# 1. Bazani va Redis'ni ko'tarish
docker compose up -d

# 2. Env faylini tayyorlash
cp .env.example .env
#    -> JWT_ACCESS_SECRET va JWT_REFRESH_SECRET ni to'ldiring (3-bo'limga qarang)

# 3. Paketlar
npm install

# 4. Prisma client + migratsiya + boshlang'ich ma'lumot
npm run generate --workspace=apps/api
npm run migrate --workspace=apps/api
npm run seed --workspace=apps/api

# 5. Hammasini ishga tushirish
npm run dev
```

Natija: web → http://localhost:3000 · admin → http://localhost:3001 ·
api → http://localhost:4000 (`GET /health` javob berishi kerak).

**Tekshiruv:** `npm run lint && npm run typecheck && npm run test && npm run build` — hammasi yashil.

---

## 3. JWT sirlarini generatsiya qilish (MAJBURIY)

Ikkalasi ham **kamida 32 belgi** va **bir-biridan farqli** bo'lishi shart —
aks holda API ishga tushmaydi (zod validatsiyasi boot'da to'xtatadi).

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Buyruqni **ikki marta** yurgizing, natijalarni `.env` ga qo'ying:

```
JWT_ACCESS_SECRET=<birinchi natija>
JWT_REFRESH_SECRET=<ikkinchi natija>
```

---

## 4. Provayderlar

Loyiha qoidasi: biznes kod **interfeysni** inject qiladi (`SmsProvider`, `MailProvider`),
implementatsiyani bilmaydi. Qaysi implementatsiya ishlashini `.env` hal qiladi.

| Env kaliti      | Qiymatlar         | Izoh                                         |
| --------------- | ----------------- | -------------------------------------------- |
| `SMS_PROVIDER`  | `mock` \| `eskiz` | `mock` — OTP kodi app log'iga yoziladi       |
| `MAIL_PROVIDER` | `mock` \| `gmail` | `mock` — email log'ga, hech narsa yubormaydi |

Lokal ishlab chiqishda **ikkalasi ham `mock`** bo'lishi kifoya — hech qanday akkaunt kerak emas.
OTP kodini terminaldagi API log'idan o'qiysiz.

> Agar `SMS_PROVIDER=eskiz` yoki `MAIL_PROVIDER=gmail` qo'ysangiz-u, tegishli kalitlarni
> to'ldirmasangiz — API **boot paytida** aniq xato bilan to'xtaydi (so'rov o'rtasida emas).

---

## 5. Gmail SMTP ni ulash (email OTP uchun)

Oddiy Gmail parol **ishlamaydi** — "App password" kerak.

1. **2FA yoqing** (App password shusiz ko'rinmaydi):
   https://myaccount.google.com/security → "2-Step Verification" → yoqing.
2. **App password yarating:**
   https://myaccount.google.com/apppasswords
   - App: `Mail`, Device: `Other` → nom: `Kidir`
   - Google 16 belgili parol beradi (masalan `abcd efgh ijkl mnop`) — **probellarsiz** ko'chiring.
3. `.env` ga yozing:

```
MAIL_PROVIDER=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sizning-manzilingiz@gmail.com
SMTP_PASSWORD=abcdefghijklmnop
SMTP_FROM=Kidir <sizning-manzilingiz@gmail.com>
```

**Eslatma:** Gmail'da kunlik limit ~500 xat. Bu v1–v2 uchun yetarli;
keyinchalik `MailProvider` implementatsiyasini almashtiramiz (kod o'zgarmaydi).

---

## 6. Google OAuth ni ulash (client uchun kirish)

1. https://console.cloud.google.com → yuqorida loyiha tanlang yoki **yangi loyiha yarating**
   (nomi: `Kidir`).
2. Chap menyu → **APIs & Services → OAuth consent screen**:
   - User Type: **External** → Create
   - App name: `Kidir`, User support email: o'z emailingiz
   - Developer contact: o'z emailingiz → Save and Continue
   - Scopes: `.../auth/userinfo.email` va `.../auth/userinfo.profile` qo'shing
   - Test users: hozircha o'z emailingizni qo'shing (ilova "Testing" rejimida bo'ladi)
3. Chap menyu → **Credentials → + Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `Kidir Web`
   - **Authorized JavaScript origins:**
     - `http://localhost:3000`
   - **Authorized redirect URIs:**
     - `http://localhost:4000/auth/google/callback`
   - Create → chiqqan **Client ID** va **Client secret** ni ko'chiring.
4. `.env` ga yozing:

```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
```

**Production'ga chiqqanda** yuqoridagi ikki URL ro'yxatiga qo'shimcha qiling:
`https://kidir.net` (origin) va `https://api.kidir.net/auth/google/callback` (redirect).

> Google OAuth loyiha qoidasi bo'yicha **faqat CLIENT roli** uchun. Callback'da `state`
> parametri majburiy validatsiya qilinadi (CSRF himoyasi).

---

## 7. Eskiz.uz SMS (hozircha kerak emas)

Eskiz akkaunti hali yo'q → `SMS_PROVIDER=mock` bilan ishlaymiz.
Akkaunt olingach:

1. https://eskiz.uz da ro'yxatdan o'ting, shartnoma imzolang, SMS nomini (alfa-nom) tasdiqlang.
2. `.env`:

```
SMS_PROVIDER=eskiz
ESKIZ_EMAIL=akkaunt-emaili
ESKIZ_PASSWORD=akkaunt-paroli
```

Kod o'zgarmaydi — `EskizSmsProvider` allaqachon `SmsProvider` interfeysini bajaradi.

---

## 8. Tez-tez uchraydigan muammolar

| Muammo                                                  | Yechim                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Error: connect ECONNREFUSED 127.0.0.1:5433`            | `docker compose up -d` yurgizilmagan yoki konteyner o'chgan. `docker ps` bilan tekshiring. |
| `Environment variable not found: DATABASE_URL`          | `.env` root papkada emas yoki yaratilmagan.                                                |
| `JWT_ACCESS_SECRET: String must contain at least 32...` | Sirlar juda qisqa — 3-bo'limdagi buyruq bilan generatsiya qiling.                          |
| `Could not resolve workspace` (turbo)                   | `package.json` dagi `packageManager` maydoni yo'q yoki `npm install` qilinmagan.           |
| Portlar band (3000/3001/4000/5433/6379)                 | Band jarayonni yoping yoki `.env`/`docker-compose.yml` da portni o'zgartiring.             |
| Prisma tipi topilmaydi                                  | `npm run generate --workspace=apps/api`                                                    |

---

## 9. Foydali buyruqlar

```bash
npm run dev                              # uchala app parallel
npm run lint && npm run typecheck        # commit oldidan MAJBURIY
npm run test                             # barcha testlar
npm run test --workspace=apps/api        # faqat api
npm run migrate --workspace=apps/api     # yangi migratsiya (prisma migrate dev)
npm run generate --workspace=apps/api    # prisma client qayta generatsiya
docker compose down                      # infra to'xtatish (ma'lumot saqlanadi)
docker compose down -v                   # infra + BAZANI O'CHIRISH (ehtiyot bo'ling!)
```
