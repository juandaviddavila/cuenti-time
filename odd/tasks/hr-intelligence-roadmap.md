# HR intelligence roadmap

Objective: deliver the approved HR intelligence capabilities while explicitly excluding exportable pre-payroll. Branch: `feat/hr-intelligence-roadmap`.
Delivery: `ask-on-risk` with `feature-branch-chain`; forecast 2,500–4,000 authored changed lines. Test runners: focused TypeScript/Vitest tests where available, `pnpm lint`, `pnpm build`, `pnpm mcp:test`, and applicable browser checks.

## Specs

1. **S1 — Executive HR agent.** Authorized requirement: “Agente ejecutivo de RR. HH. sobre MCP y reportes existentes.” Acceptance: executive HR questions use existing tenant-scoped HR reporting data and remain read-only. Checks: focused HR-domain tests and MCP tests.
2. **S2 — Automatic summaries.** Authorized requirement: “Resumen diario/semanal automático de tardanzas, ausencias y anomalías.” Delivery decision: the user answered “1”, selecting dashboard plus email. Acceptance: daily and weekly summaries are visible in the dashboard and can be delivered by email without duplicate sends. Checks: deterministic summary tests, authorization checks, idempotency tests, and email adapter tests.
3. **S3 — Assisted scheduling.** Authorized requirement: “Generador asistido de horarios con aprobación humana.” Acceptance: generated schedules remain drafts until an authorized human approves them, and detected conflicts are visible before approval. Checks: generator/conflict tests, tenant and role authorization tests, and UI flow verification.
4. **S4 — Training and certifications.** Authorized requirement: “Capacitaciones y certificados por cargo.” Acceptance: lightweight training/certification records can be scoped by position and branch, assigned to employees, and show expiry state. This is not a full LMS. Checks: domain tests, tenant/permission tests, and UI flow verification.
5. **S5 — Secure branch kiosk activation.** Authorized requirement: “Activación segura del kiosco por sucursal.” Acceptance: a branch kiosk can be activated and revoked without administrator credentials, and activation cannot cross tenant or branch boundaries. Checks: activation/revocation tests, rejected-request invariants, audit evidence, and kiosk browser verification.
6. **S6 — Clear dynamic pricing.** Authorized requirement: “Página de precios más clara, leyendo valores desde BillingConfig.” Acceptance: displayed limits and prices come from the public billing configuration rather than hardcoded product values, with a clear employee-count calculation. Checks: pricing calculation tests, fallback behavior, and marketing/app page verification.
7. **S7 — Explicit non-goal.** Authorization boundary: “procesamos con esto menos Pre-nómina exportable”. No pre-payroll calculation, export, payroll settlement, or payroll-adjacent behavior is included.

## Tasks

- **T1 — S6 — delegated (parallelism trigger with T2)** — Dynamic pricing calculator and clear pricing presentation. Status: done. Commit: `0077c2e`.
- **T2 — S1–S2 — delegated (parallelism trigger with T1)** — Shared executive summary engine, dashboard delivery, email delivery, and MCP/report integration. Status: in progress; implementation and bounded correction recheck passed locally, documentation and review closure pending. Commit: implementation in user-authored `0bfb444`; correction commit pending.
- **T3 — S5 — inline; high-risk verification required (security/auth boundary)** — Revocable branch kiosk activation and kiosk authorization flow. Status: pending. Commit: pending.
- **T4 — S3 — inline; high-risk verification required (persisted schedule drafts)** — Assisted schedule drafts, conflict detection, approval, and UI. Status: pending. Commit: pending.
- **T5 — S4 — inline; high-risk verification required (new persisted HR records)** — Lightweight training/certification catalog, assignments, expiry status, reminders, and UI. Status: pending. Commit: pending.

## Log

- **L1 — User authorization:** “procesamos con esto menos Pre-nómina exportable”
- **L2 — Delivery decision:** User answered “1” to the summary-channel question, selecting dashboard plus email.
- **L3 — Exploration:** Existing foundations include public BillingConfig, HR report services/MCP tools, an unused LateReportLog model, public kiosk routing, shifts/employee-shifts, email delivery, and CRON_SECRET route patterns. Training/certification storage is greenfield.
- **L4 — Planning:** T1 and T2 have disjoint edit surfaces and are heavier than subagent startup, so the mandatory parallel-writer trigger applies. Remaining tasks stay inline unless a later writer trigger fires. Every task keeps behavior, tests, and docs in its work-unit commit.
- **L5 — Delivery strategy:** User answered “1”, selecting a feature-branch chain. The tracker branch is `feat/hr-intelligence-roadmap`; each work unit remains independently reviewable and no PR is created without a later user decision.
- **L6 — T1 verification:** Pricing tests passed (8), marketing typecheck passed, root TypeScript passed, and an independent verifier returned S6/S7 verified with no blockers. The initial T2 launch was rejected by the runtime overlap guard before any T2 write.
- **L7 — T1 delivery:** Work-unit commit `0077c2e` (`feat(pricing): add dynamic employee calculator`). Native assessment: medium risk, `reviewDue=false`, reason `under_budget`; the slice remains pending in the feature-chain review boundary.

- **L8 — User commit reconciliation:** “si yo realice comit y lo llame a eso afecta en algo tu tarea”. Preserve user commit `0bfb444` unchanged; subsequent corrections use a separate Conventional Commit.
- **L9 — T2 bounded correction:** Initial independent verification reproduced duplicate email sends and false success on skipped SMTP. After a second correction of the same concurrency blocker, ReadCommitted with a signed-int8 advisory lock passed the independent snapshot-model recheck. Seventeen focused tests pass, as does writer TypeScript checking. No live DB/SMTP was used in the correction rechecks. SMTP success followed by transaction/process failure can still cause duplicate delivery; documented rather than claimed exactly-once.
- **L10 — T2 operational proof:** Existing DATABASE_URL and all required SMTP variables are present. Presence is not connectivity or authorization for remote use. The earlier full MCP suite failed on DB availability; only the three non-DB registry tests passed. External cron scheduling and real DB/SMTP integration remain unverified. No production deployment is authorized.
