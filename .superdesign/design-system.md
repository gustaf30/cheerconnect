# CheerConnect Design System

## Product Context
**CheerConnect** is a social network for the cheerleading community. It connects athletes, coaches, choreographers, and teams. Key features include: feed/posts, connections, team management, events, messaging, and user profiles with cheerleading-specific data (positions, career history, achievements).

**Language**: Portuguese (pt-BR)
**Target Users**: Cheerleaders, coaches, choreographers, judges in Brazil

## Key Pages
1. **Landing** — Hero, features showcase, CTA
2. **Login/Register** — Auth forms with floating orb decorations
3. **Feed** — Post creation, post cards with likes/comments/reposts, filter toggle
4. **Connections** — Tabbed view (all, received requests, sent requests)
5. **Teams** — Team cards with search/filter, create team dialog
6. **Events** — Calendar view grouped by month, event cards with CRUD
7. **Search** — User discovery with position/location filters
8. **Messages** — Split-panel messaging (conversation list + chat)
9. **Profile** — Banner, avatar, stats, tabbed content (posts, about, career, achievements)
10. **Settings** — Notification preferences with toggles

## Architecture
- Next.js 16 App Router with route groups: (auth) for public, (main) for protected
- Layout: Header (sticky, glassmorphism) + Sidebar (desktop) + Content area (max-w-3xl)
- Sidebar: Profile card, navigation, quick stats
- Mobile: Sheet drawer for sidebar

## Branding & Colors

### Primary Palette (OKLCH)
- **Primary Red**: `oklch(0.55 0.22 25)` — Vibrant red (#D72638), used for CTAs, active states, branding
- **Primary Hover**: `oklch(0.40 0.18 25)` — Darker red for hover states
- **Primary Dark**: `oklch(0.25 0.10 25)` — Very dark red for text accents
- **Secondary Rose**: `oklch(0.94 0.02 15)` — Light rose (#FBE4E3), used for backgrounds, tags
- **Background**: `oklch(0.98 0.005 15)` — Warm off-white with subtle rose tint

### Semantic Colors
- Borders: `oklch(0.90 0.02 15)` — Subtle rose-tinted borders
- Muted text: `oklch(0.5 0.02 25)` — Warm gray with rose undertone
- All grays carry a slight rose/red hue (hue channel 15-25)

### Gradients
- Primary gradient: `linear-gradient(135deg, oklch(0.55 0.22 25), oklch(0.45 0.20 25))`
- Text gradient: `linear-gradient(135deg, oklch(0.55 0.22 25), oklch(0.40 0.18 25))`
- Badge gradient: `linear-gradient(135deg, oklch(0.55 0.22 25), oklch(0.65 0.18 30))`

## Typography

### Font Families
| Font | Role | Weights |
|------|------|---------|
| **Bricolage Grotesque** | Display: titles, headers, card names | 200, 400, 700, 800 |
| **Source Sans 3** | Body: navigation, buttons, labels, paragraphs | 400, 600, 700 |
| **JetBrains Mono** | Data: stats, usernames, timestamps, counters | 400, 500 |
| **Newsreader** | Editorial: bio, descriptions, storytelling | 300, 400, 500, 600 |

### Scale
- Hero: clamp(2.5rem, 5vw, 4rem), weight 800, letter-spacing -0.02em
- Section: clamp(1.5rem, 3vw, 2rem), weight 700, letter-spacing -0.01em
- Card: 1.125rem, weight 600
- Body: default (1rem/16px)
- Small: 0.875rem, 0.75rem for meta text
- Editorial reading: 17px, line-height 1.7

### Font pairing principle
High contrast: Display (Bricolage, geometric sans) + Editorial (Newsreader, serif) + Mono (JetBrains) for data. Weight extremes: 200 vs 800, never 400 vs 600.

## Spacing & Layout
- Border radius: 14px (--radius: 0.875rem), cards use rounded-2xl
- Card padding: 32px horizontal (px-8)
- Feed gap: 32px (space-y-8)
- Content width: 768px max (max-w-3xl)
- Header: 56px height, sticky, glassmorphism
- Sidebar: 256px width, sticky below header

## Shadows (Layered depth system)
- Depth 1: Subtle resting state
- Depth 2: Card hover, elevated elements
- Depth 3: Header scroll, dialogs
- Depth 4: Modals, heavy emphasis
- Glow SM/MD/LG: Primary-colored glow for premium elements

## Effects
- **Glassmorphism**: Semi-transparent bg + backdrop-blur(20px) for header, stat cards
- **Gradient borders**: Animated gradient border via ::before pseudo-element
- **Glow**: Primary-colored box-shadow on hover for premium elements
- **Text gradient**: Background-clip text for "Cheer" in logo

## Motion & Animation

### Transitions (Standardized)
- Fast (150ms): Color changes, opacity, focus states
- Base (200ms): DEFAULT for hover, transforms, shadows
- Slow (300ms): Complex entrance animations
- All use `ease-out` for immediate, responsive feel

### Entrance Animations
- Cards/items: slide-up (translateY 10px → 0) with stagger (50ms delay per child)
- Elements: scale-in (0.9 → 1) with opacity
- Premium: scale(0.95) + translateY(8px) → overshoot to scale(1.01) → settle

### Interactive Animations
- Buttons: active:scale-[0.98] for tactile press feedback
- Cards: hover:-translate-y-px for subtle lift
- Like button: Spring sequence scale [1, 1.3, 0.95, 1.1, 1]
- Links: hover:translate-x-1 for sidebar items
- Avatars: ring-2 ring-transparent → hover:ring-primary/30

### Page Transitions (Framer Motion)
- Fade + slide + blur(8px) between pages
- AnimatePresence mode="wait"
- Feed items: staggerChildren 80ms with spring physics

### Accessibility
- All animations respect `prefers-reduced-motion: reduce`
- Disabled when user requests reduced motion

## Component Patterns
- **Cards**: rounded-2xl, py-8, px-8 content padding, 6 variants (default, glass, elevated, interactive, premium, spotlight)
- **Buttons**: 7 variants (default, destructive, outline, secondary, ghost, link, premium), active:scale-[0.98]
- **Inputs**: 3 variants (default, filled, premium) with glow focus states
- **Badges**: Rounded-full, 8 variants including gradient and subtle, hover:scale-[1.02]
- **Navigation**: Active indicator bar (3px gradient) + icon scale + bg change
- **Stats**: Mono font, tabular-nums, gradient text, glass card backgrounds
- **Loading**: Shimmer animation on skeleton components

## Project-Specific Requirements
- Cheerleading positions: FLYER, BASE, BACKSPOT, TUMBLER, etc. shown as badges
- Team categories: ALLSTAR, COLLEGE, RECREATIONAL, SCHOOL, PROFESSIONAL
- Connection states: none → pending → accepted (bidirectional)
- Media: Up to 4 images OR 1 video per post
- Reposts: Nested post card showing original
- Brazilian city/state selector using IBGE API
