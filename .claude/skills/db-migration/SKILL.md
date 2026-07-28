---
name: db-migration
description: Prisma schema o'zgarishi va migratsiyani xavfsiz bajaradi
argument-hint: [o'zgarish tavsifi]
disable-model-invocation: true
---
O'zgarish: $ARGUMENTS

1. `schema.prisma`ni o'zgartir (database.md qoidalariga rioya: BigInt pul, UUID v7 id, enum status, indexlar)
2. Breaking change'mi tekshir: ustun o'chirish/rename bo'lsa — backward-compatible 2 bosqichli reja taklif qil
3. `npm run migrate --workspace=apps/api -- --name <manoli_nom>` — nomni inglizcha, snake_case
4. Mavjud migratsiyalarga TEGMA. Seed kerak bo'lsa alohida ayt.
5. Ta'sirlangan repository/service kodlarini yangilab, testlarni yurgiz.
