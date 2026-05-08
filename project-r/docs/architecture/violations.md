# Architecture Pattern Violations Log

This file logs deviations from the canonical architecture, with rationale and remediation owner.

| Date | Story | Violation | Rationale | Remediation | Status |
| --- | --- | --- | --- | --- | --- |
| 2026-05-08 | 1.1 | shadcn 4.x defaults to Base UI (`@base-ui/react`); architecture.md#L249 specifies Radix UI | Architecture decision honored: re-initialized with `--base radix --preset nova`. `@base-ui/react` removed. | None — aligned with architecture. | resolved |
| 2026-05-08 | 1.1 | Default `Button` ships with 6 variants (default/outline/secondary/ghost/destructive/link); UX-DR30 mandates exactly 3 (primary/ghost/destructive) | Story 1.1 scope is to *initialize* shadcn; Button vocabulary is owned by Story 1.8 | Story 1.8 will replace `button.tsx` with the 3-variant version | deferred-to-1.8 |
| 2026-05-08 | 1.1 | `globals.css` `@theme` block uses shadcn's default token vocabulary (background/foreground/muted/...) instead of Project R canon (bg/text/border/accent/signal-{ready,caution,alert,info,neutral}) | Story 1.1 only validates the `@theme` mechanism; full token set is Story 1.8 (UX-DR1–UX-DR4) | Story 1.8 replaces token vocabulary | deferred-to-1.8 |
| 2026-05-08 | 1.1 (code-review) | AR2 installed recharts but removed via code review (PATCH-05) to keep scaffold lean | Recharts was deferred to Phase 2; violates "no speculative dependencies"; tree-shaking may not remove unused code | Re-add in Phase 2 story that first uses it with explicit AC for bundle size verification | removed |
| 2026-05-08 | 1.1 (code-review) | DECISION-01: Next.js 16.2.6 + Node 22.11.0 compatibility not explicitly documented in vendor release notes | Version pair is current but unverified for compatibility; Haiku code review flagged as risk | Option 1 chosen: Accept current versions; add integration tests in Story 1.13 (CI/CD) to verify dev/build/lint/test paths work | deferred-to-1.13 |
