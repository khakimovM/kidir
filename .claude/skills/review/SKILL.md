---
name: review
description: Joriy o'zgarishlarni Kidir standartlari bo'yicha review qiladi
disable-model-invocation: true
---
## O'zgarishlar
!`git diff HEAD --stat`

code-reviewer subagentini ishga tushir. Natija: Kritik → Ogohlantirish → Taklif.
Kidir-maxsus: float bilan pul? Ledger'siz balans? Guard'siz endpoint? localStorage'da token?
CSRF header tekshiruvisiz mutation? Provider-interfeys chetlab implementatsiya importi?
Shared'dan tashqari duplikat type? Hardcode limit/komissiya (config o'rniga)?
Admin kodi web bundle'ida?
