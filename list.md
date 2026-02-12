## Testing

- [x] **P3** — Add unit tests for critical API routes: auth endpoints, post CRUD, messaging, team permissions.
- [ ] **P3** — Add E2E tests for core user flows: login → create post → like → send message.
- [ ] **P3** — Test keyboard navigation across all pages (tab order, focus traps in modals, skip links).
- [ ] **P3** — Run Lighthouse accessibility audit and fix score below 90.

## Post-Launch Polish

- [ ] **P3** — Integrate content moderation API for post/comment screening.
- [ ] **P3** — Implement soft delete for user accounts (GDPR-style data retention).
- [ ] **P3** — Add idempotency keys to POST routes (prevent duplicate creates on retry).
- [x] **P3** — Set up CI/CD pipeline (GitHub Actions → Vercel / Docker deploy).
- [x] **P3** — Add analytics instrumentation (Vercel Analytics or GA4).
- [ ] **P3** — Generate OpenAPI/Swagger docs for all API routes.
- [ ] **P3** — Implement JWT token revocation via `tokenVersion` on User model.