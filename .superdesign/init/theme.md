# Theme & Design Tokens

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 (CSS-only config, no tailwind.config.ts)
- **Component Library**: shadcn/ui (customized with CVA variants)
- **Animations**: Framer Motion + CSS keyframes
- **PostCSS**: `@tailwindcss/postcss`

## Fonts (Google Fonts, loaded in layout.tsx)

| Variable | Font | Weights | Usage |
|----------|------|---------|-------|
| `--font-display` | Bricolage Grotesque | 200, 400, 700, 800 | Titles, headers, card headers |
| `--font-body` | Source Sans 3 | 400, 600, 700 | Navigation, buttons, labels, body text |
| `--font-mono` | JetBrains Mono | 400, 500 | Stats, usernames, timestamps |
| `--font-editorial` | Newsreader | 300, 400, 500, 600 (normal+italic) | Bio, descriptions, long-form text |

## Color Palette (OKLCH)

### Light Mode
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.98 0.005 15)` | Page background |
| `--foreground` | `oklch(0.145 0 0)` | Main text |
| `--card` | `oklch(1 0 0)` | Card backgrounds |
| `--primary` | `oklch(0.55 0.22 25)` | CTAs, branding (#D72638 vibrant red) |
| `--primary-hover` | `oklch(0.40 0.18 25)` | Button hover |
| `--primary-dark` | `oklch(0.25 0.10 25)` | Dark text accents |
| `--secondary` | `oklch(0.94 0.02 15)` | Light rose backgrounds (#FBE4E3) |
| `--secondary-foreground` | `oklch(0.25 0.10 25)` | Text on secondary |
| `--muted` | `oklch(0.96 0.01 15)` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.5 0.02 25)` | Muted text |
| `--accent` | `oklch(0.92 0.03 15)` | Light rose tint |
| `--border` | `oklch(0.90 0.02 15)` | Borders |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Error states |

### Dark Mode
| Token | Value |
|-------|-------|
| `--background` | `oklch(0.12 0.02 25)` |
| `--foreground` | `oklch(0.98 0 0)` |
| `--card` | `oklch(0.16 0.02 25)` |
| `--primary` | `oklch(0.60 0.20 25)` |
| `--secondary` | `oklch(0.22 0.04 25)` |
| `--border` | `oklch(0.25 0.03 25)` |

## Design Values
| Property | Value | Note |
|----------|-------|------|
| `--radius` | 0.875rem (14px) | Softer, editorial feel |
| Card padding | px-8 (32px) | Generous breathing room |
| Card rounding | rounded-2xl | |
| Feed gap | space-y-8 (32px) | Whitespace between posts |
| Content max-width | max-w-3xl (768px) | Narrower for readability |
| Header height | h-14 (56px) | |
| Sidebar width | w-64 (256px) | |

## Premium Shadows
```css
--shadow-glow-sm: 0 0 15px oklch(0.55 0.22 25 / 0.2);
--shadow-glow-md: 0 0 25px oklch(0.55 0.22 25 / 0.3);
--shadow-glow-lg: 0 0 40px oklch(0.55 0.22 25 / 0.35);
--shadow-depth-1: 0 1px 3px oklch(0 0 0 / 0.04), 0 1px 2px oklch(0 0 0 / 0.06);
--shadow-depth-2: 0 4px 6px oklch(0 0 0 / 0.05), 0 2px 4px oklch(0 0 0 / 0.06);
--shadow-depth-3: 0 10px 20px oklch(0 0 0 / 0.08), 0 4px 8px oklch(0 0 0 / 0.06);
--shadow-depth-4: 0 20px 40px oklch(0 0 0 / 0.1), 0 8px 16px oklch(0 0 0 / 0.06);
```

## Glassmorphism
```css
--glass-bg: oklch(1 0 0 / 0.7);
--glass-border: oklch(1 0 0 / 0.2);
--glass-blur: 20px;
```

## Easings
```css
--ease-spring: cubic-bezier(0.25, 0.46, 0.45, 0.94);
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.34, 1.2, 0.64, 1);
--ease-luxury: cubic-bezier(0.45, 0, 0.15, 1);
```

## Transition Classes
- `.transition-fast` — 150ms ease-out (colors, opacity, focus)
- `.transition-base` — 200ms ease-out (DEFAULT hover, transforms)
- `.transition-slow` — 300ms ease-out (complex entrances)

## Key Animation Classes
- `.animate-heart-pop` — Like button bounce
- `.animate-scale-in` — Element entrance
- `.animate-slide-up` — Card slide up
- `.animate-fade-in` — Fade in
- `.animate-pulse-ring` — Notification pulse
- `.animate-float` — Gentle floating
- `.animate-premium-entrance` — Premium entrance with overshoot
- `.animate-shimmer-premium` — Loading shimmer
- `.hover-lift` — Lift on hover
- `.press-effect` — Button press tactile
- `.glass` / `.glass-subtle` — Glassmorphism
- `.gradient-border` — Animated gradient border
- `.hover-glow` — Glow on hover
- `.text-gradient-primary` — Primary gradient text
- `.nav-indicator` — Active nav indicator bar
- `.card-hover` — Card elevation on hover
- `.avatar-glow` — Avatar glow on hover

## Typography Utility Classes
- `.font-display` — Bricolage Grotesque
- `.font-body` — Source Sans 3
- `.font-mono` — JetBrains Mono
- `.font-editorial` — Newsreader
- `.text-editorial` — Newsreader 17px, line-height 1.7
- `.heading-hero` — clamp(2.5rem, 5vw, 4rem), weight 800
- `.heading-section` — clamp(1.5rem, 3vw, 2rem), weight 700
- `.heading-card` — 1.125rem, weight 600
- `.stat-number` — Mono with tabular-nums
