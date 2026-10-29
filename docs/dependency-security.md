# Dependency security maintenance

Run `pnpm install --frozen-lockfile` and `pnpm audit` to reproduce the dependency audit. CI runs `pnpm audit --audit-level=moderate` against production and development dependencies; moderate, high and critical findings fail the build. Low findings remain visible in its output. No advisory is ignored.

## Cleanup on 2026-10-29

The full pnpm audit changed from 115 findings (1 critical, 64 high, 42 moderate, 8 low) to one low finding. Counts are a snapshot of the registry advisory database on this date.

- Update Axios from 1.10.0 to 1.21.0, including patched `form-data` and `follow-redirects`.
- Update PostCSS to 8.5.32. The `postcss@^8.0.0: $postcss` pnpm override also replaces vulnerable copies pinned by Next.js and styled-components with the root PostCSS 8 version. Keep the override until all dependent packages resolve a patched version without it; verify production styles when changing it.
- Refresh vulnerable Babel, glob, minimatch, YAML, Ajv, flatted, selector parser and Browserslist dependencies within their declared version ranges.
- Preserve iOS 16.6+ in Autoprefixer's targets alongside `defaults`. The previous browser data included iOS 16.6–16.7, but the refreshed defaults drop it and omit WebKit prefixes for blur, selection and decoration. Keep those existing styles without changing Next.js JavaScript targets; `tests/css-compatibility.test.ts` covers the real CSS transformation.
- Remove unused Lodash and its type package.
- Remove inactive `next-pwa`, `next-compose-plugins` and the standalone webpack peer. The previous configuration passed the PWA options factory directly into the composer, which merged the returned function without applying it. Next's resolved configuration had no webpack hook, and the build generated no service worker. The plain Next config retains the same compiler and image settings. The web manifest, icons and existing install guidance remain unchanged. This cleanup does not introduce offline support.

Next.js 15.5.28, React 18, NextUI, application components, API contracts and recommendation logic are retained.

## Remaining upstream advisory

| Dependency path | Advisory | Status |
| --- | --- | --- |
| `@nextui-org/react > @nextui-org/theme > deepmerge@4.3.1` | [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4): prototype poisoning of merged objects; low severity | No upstream patched release as of 2026-10-29 |

The application's `tailwind.config.js` calls `nextui()` without user-supplied options. The affected merge calls combine the library's default theme/layout objects during CSS generation. Application request data, address results, participant names and shared-link parameters are not passed into this plugin. This limits exposure in the current application; it does not fix the dependency itself.

Retain the existing UI library for this update to preserve its appearance and behavior. Reassess this advisory before accepting external theme objects, and update the dependency when a compatible upstream fix becomes available. A future NextUI/HeroUI migration needs its own visual and interaction verification. Deprecation notices for the existing NextUI and ESLint releases are separate from the audit result.
