# Gym Trainer — Design Tokens (Stitch)

> Extraído de Google Stitch el 24 de junio de 2026.

## Colors (dark)

| Token | Value | Uso |
|-------|-------|-----|
| `background` | `#0a0a0f` | Body bg, app canvas |
| `surface` | `#131318` | Cards, header bg |
| `surface-dim` | `#131318` | Surface variant |
| `surface-bright` | `#39383e` | Bright surface |
| `surface-container` | `#1f1f25` | Elevated surfaces, nav bg |
| `surface-container-low` | `#1b1b20` | Low container |
| `surface-container-lowest` | `#0e0e13` | Lowest container |
| `surface-container-high` | `#2a292f` | Input bg, exercise rows |
| `surface-container-highest` | `#35343a` | Chips, tags, badges |
| `surface-variant` | `#35343a` | Surface variant |
| `on-surface` | `#e4e1e9` | Text on surface |
| `on-surface-variant` | `#e0c0b1` | Secondary text, labels, icons |
| `on-background` | `#e4e1e9` | Text on background |
| `primary` | `#ffb690` | Accents, active states, icons |
| `primary-container` | `#f97316` | Primary buttons, active tab, glow |
| `on-primary` | `#552100` | Text on primary-container |
| `on-primary-container` | `#582200` | Text on primary surfaces |
| `primary-fixed` | `#ffdbca` | |
| `primary-fixed-dim` | `#ffb690` | |
| `inverse-primary` | `#9d4300` | |
| `secondary` | `#7bd0ff` | Secondary accents |
| `secondary-container` | `#00a6e0` | Secondary fills (macros) |
| `tertiary` | `#cebdff` | Tertiary accents |
| `tertiary-container` | `#a589f8` | Tertiary fills |
| `error` | `#ffb4ab` | Errors |
| `error-container` | `#93000a` | Error bg |
| `outline` | `#a78b7d` | Borders, dividers |
| `outline-variant` | `#584237` | Subtle borders |
| `green` | `#10b981` | Exercise sets completed |

### Glass tokens

| Token | Value |
|-------|-------|
| `glass-bg` | `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)` |
| `glass-bg-solid` | `rgba(20,20,25,0.7)` |
| `glass-blur` | `blur(12px)` |
| `glass-border` | `1px solid rgba(255,255,255,0.06)` |
| `glass-radius` | `14px` |
| `primary-glow` | `rgba(249,115,22,0.2)` |
| `primary-glow-strong` | `rgba(249,115,22,0.4)` |

### Gradientes atmosféricos

```css
/* Lock screen */
radial-gradient(circle at top left, rgba(249,115,22,0.15) 0%, transparent 50%)
radial-gradient(circle at bottom right, rgba(165,137,248,0.12) 0%, transparent 50%)

/* Timer screen */
radial-gradient(circle at 20% 30%, rgba(249,115,22,0.15) 0%, transparent 40%)
radial-gradient(circle at 80% 70%, rgba(0,166,224,0.1) 0%, transparent 40%)
```

## Typography

| Token | Size | Weight | Line H | Letter S | Uso |
|-------|------|--------|--------|----------|-----|
| `display-lg` | 36px / 2.25rem | 800 | 1.1 | -0.02em | Hero numbers, brand |
| `headline-lg` | 24px / 1.5rem | 800 | 1.2 | — | Section titles |
| `headline-md` | 20px / 1.25rem | 700 | 1.3 | — | Exercise names, card titles |
| `subheading` | 16px / 1rem | 600 | 1.4 | — | Day names, subtitles |
| `body-lg` | 16px / 1rem | 400 | 1.5 | — | Body text |
| `body-md` | 14px / 0.875rem | 400 | 1.5 | — | Secondary body, descriptions |
| `label-sm` | 12px / 0.75rem | 600 | 1.2 | — | Tabs, buttons, labels |
| `caption` | 10.4px / 0.65rem | 500 | 1.2 | — | Badges, timestamps, meta |

Font family: **Inter**, sans-serif

## Spacing

| Token | Value |
|-------|-------|
| `xs` | 0.25rem / 4px |
| `sm` | 0.5rem / 8px |
| `md` | 1rem / 16px |
| `lg` | 1.5rem / 24px |
| `xl` | 2rem / 32px |
| `touch-target` | 44px |

## Shape (border-radius)

| Level | Value |
|-------|-------|
| DEFAULT | 0.25rem / 4px |
| lg | 0.5rem / 8px |
| xl | 0.75rem / 12px |
| full | 9999px |

## Brand

**GYMTRAINER** — GYM en `primary` (#ffb690), TRAINER en `primary-container` (#f97316).
Icon: `fitness_center` (Material Symbol).
