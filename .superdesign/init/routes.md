# Route Structure

## Route Groups

### `(auth)/` — Public authentication pages
- `/(auth)/login` → `src/app/(auth)/login/page.tsx` — Login with email/password + Google OAuth
- `/(auth)/register` → `src/app/(auth)/register/page.tsx` — Registration form

### `(main)/` — Protected pages (require authentication)
- `/(main)/feed` → `src/app/(main)/feed/page.tsx` — Feed with filter toggle (following | all)
- `/(main)/connections` → `src/app/(main)/connections/page.tsx` — Connections with tabs (all, received, sent)
- `/(main)/teams` → `src/app/(main)/teams/page.tsx` — Teams list with search + filters
- `/(main)/teams/[slug]` → `src/app/(main)/teams/[slug]/page.tsx` — Team profile
- `/(main)/teams/[slug]/edit` → `src/app/(main)/teams/[slug]/edit/page.tsx` — Team settings
- `/(main)/teams/invites` → `src/app/(main)/teams/invites/page.tsx` — Team invites
- `/(main)/events` → `src/app/(main)/events/page.tsx` — Events calendar with CRUD
- `/(main)/search` → `src/app/(main)/search/page.tsx` — User search with filters
- `/(main)/messages` → `src/app/(main)/messages/page.tsx` — Messages inbox
- `/(main)/messages/[conversationId]` → `src/app/(main)/messages/[conversationId]/page.tsx` — Conversation view
- `/(main)/profile` → `src/app/(main)/profile/page.tsx` — Redirects to /profile/[username]
- `/(main)/profile/[username]` → `src/app/(main)/profile/[username]/page.tsx` — User profile with tabs
- `/(main)/profile/edit` → `src/app/(main)/profile/edit/page.tsx` — Profile editor
- `/(main)/settings` → `src/app/(main)/settings/page.tsx` — User settings

### Root
- `/` → `src/app/page.tsx` — Landing page with hero, features, CTA

## Layout Hierarchy
```
RootLayout (src/app/layout.tsx)
├── Landing page (/)
├── AuthLayout (src/app/(auth)/layout.tsx)
│   ├── Login (/login)
│   └── Register (/register)
└── MainLayout (src/app/(main)/layout.tsx)
    ├── Feed (/feed)
    ├── Connections (/connections)
    ├── Teams (/teams, /teams/[slug], etc.)
    ├── Events (/events)
    ├── Search (/search)
    ├── Messages (/messages, /messages/[id])
    ├── Profile (/profile, /profile/[username], /profile/edit)
    └── Settings (/settings)
```
