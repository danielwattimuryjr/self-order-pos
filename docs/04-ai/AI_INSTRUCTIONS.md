# AI Coding Agent Instructions

You are implementing QR Restaurant Ordering System V1. Read all project documents before coding. `BUSINESS_RULES.md` is the authoritative source for business behavior.

## Non-negotiable rules

1. Do not invent product behavior. If a requirement is ambiguous, state the ambiguity and propose a default; do not silently implement a guess.
2. Do not contradict approved business rules. If legacy code/docs conflict, follow current docs and explain the reconciliation.
3. Do not build the entire application in one pass. Follow `IMPLEMENTATION_PLAN.md` phase by phase and work in small, reviewable vertical slices.
4. Before editing, inspect the existing repository, package manager, conventions, and current implementation. Do not overwrite working patterns without reason.
5. Use Next.js App Router + Route Handlers. Do not create a separate Express backend.
6. Use TypeScript strict typing, Zod validation, server-side authorization, Supabase RLS, and migrations in version control.
7. Backend/database are the source of truth for money, order state, payment state, voucher quota, session validity, and access control.
8. Never trust client-submitted price, discount, role, payment success, or order totals.
9. Use integer rupiah or NUMERIC with zero scale; never use floating point for money.
10. Use atomic database operations for session uniqueness, order sequence, voucher reservation, payment transitions, and ticket creation.
11. Payment webhook must be verified, deduplicated, and idempotent. A successful payment creates exactly one kitchen ticket.
12. Do not expose Supabase service role or provider secrets to the browser.
13. Customer order access uses a cryptographically random per-order token; store token hash, not raw token.
14. Historical orders use snapshots and must not change when catalog/templates/vouchers are edited.
15. Staff has read-only operational access; no kitchen status workflow, no Admin analytics.
16. No physical printer, print agent, print jobs, or fake print success in V1.
17. All operational date/time logic uses `Asia/Jakarta`.
18. Add tests for concurrency, money, payment, authorization, and state transitions.

## Working protocol for each task

1. Summarize the requested slice and relevant acceptance criteria.
2. Inspect relevant files and dependencies.
3. Propose a concise implementation plan.
4. Implement only the agreed slice.
5. Add/update migrations and tests.
6. Run lint, typecheck, and relevant tests.
7. Report changed files, behavior, commands run, results, and remaining risks.
8. Do not claim a command/test passed unless it was actually run.

## Code quality

- Keep route handlers thin; put business logic in domain services.
- Prefer explicit state machines and discriminated unions.
- Use stable error codes and consistent response envelopes.
- Handle loading/empty/error/forbidden/offline states.
- Avoid duplicate sources of truth.
- Keep components accessible and responsive.
- Avoid unnecessary abstraction and speculative dependencies.
- Keep environment variables documented in `.env.example`; never commit secrets.

## First task

Start with Phase 0 only. Inspect the repository and produce a proposed foundation plan. Do not begin Phase 1 until the foundation is reviewed and verified.
