---
paths:
  - "apps/web/**"
---

# Kidir Dizayn Tizimi (Anthropic-uslub minimalizm)

## Falsafa

Ko'p havo, kam element, aniq iyerarxiya. Ishonch va professionallik hissi.
❌ Binafsha-ko'k gradientlar, glassmorphism, shishirilgan shadow'lar, 16px+ radius.

## Ranglar (faqat CSS var, hardcode taqiqlangan) — globals.css'da

- Fon: `--bg: #FAF9F5` (warm oq), dark: `#1A1915`
- Surface: `--surface: #FFFFFF`, dark: `#232220`
- Matn: `--text: #191919`, muted: `--text-muted: #6B6A66`
- Accent (bitta!): `--accent: #C15F3C` (terrakota) — CTA, link, fokus
- Semantik: success `#2D7A4F`, warning `#B8860B`, danger `#B3382C`

## Tipografika

- Sarlavha: "Sora" 600, letter-spacing -0.02em | Matn: "Inter" 400, line-height 1.6
- Shkala: 12/14/16/20/28/40/56 — boshqa o'lcham YO'Q

## Spacing va komponentlar

- 4px shkala: 4,8,12,16,24,32,48,64. Section: 96px desktop / 48px mobile
- Border: 1px solid rgba(0,0,0,0.08), radius 8px (button/input), 12px (card)
- Status badge'lar semantik rangda, past saturatsiyali fon + to'q matn
- Animatsiya (Framer Motion): 0.2–0.35s, easing [0.22,1,0.36,1], faqat transform+opacity

## Struktura

- Dashboard: chap sidebar nav (profil, loyihalar, jamoalar, xabarlar, arizalar, balans)
- Komponentlar `components/ui/` (primitivlar) va `components/features/` (domen)
- Har interaktiv element: hover, focus-visible, disabled, loading holatlariga ega
