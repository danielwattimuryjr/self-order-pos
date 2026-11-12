# AGENTS.md — Project Instructions

## 1. Start here

Before implementing a feature, read `docs/README.md` and consult the relevant documents under `docs/`. Do not assume every document must be loaded for every task; select the documents relevant to the change.

## 2. Documentation authority

- Product scope and requirements: `docs/00-product/PRD.md`.
- Business behavior and invariants: `docs/00-product/BUSINESS_RULES.md`.
- User journeys: `docs/00-product/USER_FLOWS.md`.
- UI behavior: `docs/00-product/UI_UX_SPEC.md`.
- Visual design system, when present: `docs/00-product/DESIGN.md`.
- Technical decisions: relevant files in `docs/01-architecture/`.
- Local setup: `docs/01-architecture/LOCAL_DEVELOPMENT.md`.
- Testing requirements: `docs/02-quality/TESTING.md`.
- Delivery sequence: `docs/03-implementation/IMPLEMENTATION_PLAN.md`.

The `docs/legacy/` folder is historical reference. Do not treat it as the current source of truth when it conflicts with approved current documentation. The master document under `docs/reference/` is a consolidated reference; use the specific topic document for implementation details.

## 3. Non-negotiable project rules

- Follow agreed business rules. Do not invent or silently reinterpret requirements. Ask for clarification when a missing decision materially affects behavior.
- The database/server is the source of truth for prices, totals, discounts, voucher quotas, order state, and payment state. Never trust these values from the browser.
- Keep financial and concurrency-sensitive operations atomic using database transactions or appropriately designed Postgres functions.
- Preserve immutable transaction snapshots so later menu or price changes do not rewrite order history.
- Treat Realtime as a notification/update mechanism, not as proof of authorization or payment.
- Verify payment through the trusted server-side provider flow/webhook and make processing idempotent.
- Do not expose service-role keys, secrets, or provider credentials to client code.
- Do not change agreed API contracts, response shapes, or database semantics without approval and corresponding documentation updates.
- Implement incrementally according to `docs/03-implementation/IMPLEMENTATION_PLAN.md`.

## 4. Development environment

- Local development uses Docker Desktop + Supabase CLI.
- Run the Supabase local stack through Supabase CLI; do not substitute production Supabase credentials.
- Production V1 uses hosted Supabase and Vercel. Local development does not imply self-hosting Supabase in production.
- Follow `docs/01-architecture/LOCAL_DEVELOPMENT.md` for setup, migrations, seed data, and troubleshooting.

## 5. Implementation workflow

1. Identify the relevant requirement, business rule, user flow, and technical specification.
2. State any ambiguity or assumption before making a behavior-changing decision.
3. Implement the smallest coherent increment.
4. Add or update tests for the affected behavior, especially payment, order lifecycle, permissions, concurrency, and data integrity.
5. Run relevant tests, type checks, and lint commands available in the repository.
6. Update documentation when an approved requirement or technical decision changes.
7. Summarize files changed, behavior implemented, tests run, and any remaining risks.

## 6. Code quality

- Prefer clear, typed, maintainable code over unnecessary abstractions.
- Validate untrusted input at server boundaries.
- Keep route handlers thin and domain rules in appropriate services/modules.
- Avoid unrelated refactors and avoid renaming public API fields without approval.
- Never claim tests passed unless they were actually run and passed.

## 7. Security Instructions

### 7.1. Sensitive Files

The following files and directories are strictly
off-limits:

- .env*
- secrets/
- credentials/
- certificates/
- backups/
- *.pem
- *.key
- *.p12
- *.pfx
- Database dumps

### 7.2. Security Rules

1. Never attempt to read sensitive files.
2. Never attempt to modify sensitive files.
3. Never display credentials or secrets in terminal output.
4. Never copy secrets into source code.
5. Never expose environment variables in logs.
6. Never modify security configurations without
   explicit user approval.
7. Never disable or bypass the configured sandbox.
8. Never request elevated filesystem permissions
   to access protected files.

### 7.3. Development Rules

- Use .env.example as a configuration reference
  when available.
- Use placeholder credentials in documentation.
- Keep production credentials outside the
  development workspace.
- Ask the user when additional permissions are
  genuinely required.
