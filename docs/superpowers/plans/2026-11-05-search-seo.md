# Search SEO implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make OKNAWA discoverable and understandable for midpoint and meeting-place searches.

**Architecture:** Server metadata and explicit home indexing replace the handwritten client head.
Kakao scripts remain client components in the three interactive route layouts. Existing home
design gains explanatory content, with build-output checks guarding search behavior.

**Tech Stack:** Next.js 15, React 18, TypeScript, styled-components, Node 20, pnpm 10.32.1.

**Spec:** [search SEO design](../specs/2026-11-05-search-seo-design.md)

## Global constraints

- Preserve public RPC/RLS and current midpoint/fixed-destination flows.
- Production search origin is `https://www.oknawa.com`, independent of preview/runtime base URL.
- Index the home only. Do not fabricate rankings, volumes, review data or performance scores.
- No new dependencies, paid analytics, provider configuration or database changes.
- Registration and indexing require separate authenticated follow-through after deployment.

## Review focus

- Server/client boundary changes must preserve styled-components and hydration.
- Home-to-search navigation must load the SDK; direct result URLs must still work.
- Result queries and invitation URLs must retain noindex without home canonical inheritance.
- Public ownership tokens must render by default; supplied overrides must render exactly.
- At 320px and 200% text size, guidance must remain readable and entry actions reachable.

## Tasks

- [x] Record production HTML/404 sitemap/307 redirect findings and keyword intent research in `docs/seo.md`.
- [x] Complete `src/config/seo.ts`, server `src/app/layout.tsx`, home metadata and WebSite data.
- [x] Move scripts to `src/components/KakaoScripts/index.tsx` and interactive route layouts.
- [x] Finish home copy in `src/views/main/MainView.tsx`, preserving entry order and visual identity.
- [x] Run `scripts/check-seo.mjs` against the prior build to observe missing metadata failure,
  then new build to prove head/noindex/structured data/robots/sitemap contracts.
- [x] Add CI and full-harness invocation, including verification-token checks.
- [x] Run full harness and browser smoke for direct/together, midpoint/confirmation, themes,
  mobile/desktop, JavaScript-disabled content, keyboard FAQ, and SDK network loading.
- [x] Conduct one independent code review, fix material findings and validate affected paths.
- [ ] Commit scoped changes and create a PR with evidence and remaining account-dependent steps.

## Execution record

2026-11-05: Existing worktree and `codex/search-seo` contain only this task's draft edits.
Latest origin/main is `de14b9f`. PageSpeed public API returned 429; no field/lab score claimed.
Ruling: keep one search landing page for this pass; future pages require distinct intent and content.

Node 20 full harness passed with verification overrides and without them: 265 app/SQL tests,
56 Deno tests, audit, lint, build, 9 static pages and 5 HTTP routes across 3 user agents.
Browser smoke passed at 320px, landscape and desktop, dark/light, 200% text, keyboard FAQ,
JavaScript-disabled home, midpoint/vote/confirm/reset and direct/together destination routes.
Provider responses and SDKs in the flow smoke were mocked; this is not live-provider validation.
Home requested neither Kakao SDK. No numeric real-world performance gain is claimed.

Independent review found two checker gaps: missing Next production .env loading and body checks
that could pass on metadata alone. Both were fixed. A temporary production .env fixture passed;
removing the rendered guide while retaining metadata caused the expected failure.
The checker also now handles a server that has already exited during cleanup.

The user delegated search registration. Existing browser sessions allowed Google URL-prefix
property creation and Google/Naver HTML token issuance. Public tokens were added to the PR;
ownership completion, sitemap submission and indexing requests await production deployment.
