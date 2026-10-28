# Address search and result panel QA

Selected direction: first displayed paired mock, explicitly selected by the user. Preserve the existing identity and apply familiar refinement to address search and results only.

Source visual truth: selected paired mock `exec-452763fa-549d-4833-853f-941c014f3052.png`, retained in the local design evidence.

Committed screenshots: [dark](./address-result-dark.webp) and [light](./address-result-light.webp). Detailed comparison captures are local design evidence, not required to run the product.

The local verification fixtures render the actual source components, styles, providers and hooks. Only the unavailable Kakao SDK, read-only service responses, map and router are replaced in an external fixture. All backend mutations are blocked. Data is fictional. No mock data or preview routes were added to the product.

## Comparison evidence

The source is 1354 × 1162 pixels. App crops are (90,46)-(657,1162) and (697,46)-(1264,1162). Each 567 × 1116 crop is proportionally normalized to 390 × 768 pixels. Actual screenshots are 390 × 844 CSS pixels at density 1; source crops are padded, never stretched. The source has a shorter viewport aspect ratio, so blank space and panel position alone are not treated as drift.

`comparison-first.png` and `comparison-final.png` place each source beside its implementation. Final state is dark theme, query 강남, two results; result panel expanded, 사당역, recommended sorting, three participants, 35-minute average, 42-minute maximum and one vote. The address is focused in the final dark capture. The full-page screenshot labels are outside the UI.

`comparison-participants.png` compares the participant rows at a common 338px content width: source crop (727,757)-(1233,949), normalized to 338 × 128; implementation crop (21,544)-(359,703), 338 × 159. The implementation intentionally reuses existing 36px avatars and taller rows. Dark/light paired evidence is saved as `docs/design/address-result-dark.webp` and `docs/design/address-result-light.webp`.

## Findings and fixes

- P2: The first expanded panel pushed the candidate-comparison entry beneath the scrolling boundary at 390 × 844. Reduced local vertical gaps and padding while retaining 40px sorting controls and the original 88dvh panel limit. In the final capture the comparison label and control are visible immediately below all three participants. A fractional border pixel at the scroll boundary has no effect on interaction.
- P2: Existing home/share/tail icons remained white in light mode. Scoped their original SVG fill/stroke to currentColor without changing shared icons or their shape. Confirmed in `result-light-final.jpg` and `result-long-320-final.jpg`.
- P2: At 320px, the initial name wrapper prevented long names from shrinking and they overlapped transport text. Limited flex-shrink: 0 to the avatar wrapper. `result-long-320-final.jpg` shows a two-line name; measured name.right <= mode.left for every row.
- P2 functional: Optional history persistence could block choosing a result for malformed stored data or failed storage writes. Select the address first and isolate optional persistence, using validated history. Both cases were reproduced with the actual component and now have passing regression tests.

These findings were fixed and confirmed. No actionable P0/P1/P2 finding remains in the changed scope. Final independent code review reported no remaining actionable finding.

## Fidelity surfaces

| Surface            | Assessment                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typography         | Existing font stack retained. Address title 24px, field 16px with transform:none, result names 17px and addresses 14px. Participant names 14px, times 15px with tabular numerals. Long Korean names/addresses wrap.                                                                                                                                   |
| Spacing and layout | Existing map/bottom-panel structure and centered 500px desktop shell retained. Address input 48px, flat result rows, six sort pills, three summary metrics, directly visible participant group, separate comparison disclosure and persistent vote/confirm actions. 320px uses normal vertical scrolling and allows footer wrapping.                  |
| Colors and tokens  | Existing dark/light surfaces, green primary and rounded corners preserved. Secondary text derives locally from foreground/muted tokens. Light selected-text and focus contrast are derived locally. No global theme changes. Generated texture and blue focus color are intentionally replaced with the current flat surfaces and green focus system. |
| Images and icons   | No new raster imagery needed. Existing Avatar and existing result icons retained; scoped icon colors now support light mode. Address icons use the existing Lucide dependency. Third avatar stays the established pink instead of the generated green.                                                                                                |
| Copy and content   | Original recommendation descriptions, sorting labels and voting/host actions retained. Repeated recommendation headings/badges removed from the summary; original detailed evidence remains accessible. Participant mode and time use live component data with the existing legacy fallback.                                                          |

## Functional and responsive verification

- Search initial/loading/empty/error/success states distinguished. Clearing removes pending results. Latest query wins if callbacks arrive out of order; typing before SDK readiness searches once ready.
- Address results select with Enter and update the departure field. Recent searches appear after clearing. Empty search and simulated service errors recover on a new query.
- Panel expand/collapse, candidate selection, sorting and separate route/comparison disclosures work with native buttons and keyboard activation. Selecting 이수역 changed times to 31/32/45; selecting 동작역 changed times to 35/31/46. Sorting by votes selected the two-vote candidate.
- Mixed transit/car and explicit walking display correctly. Legacy missing per-route modes with group car display 자동차; transit-only sort controls remain filtered as before.
- Vote action opens the existing confirmation modal. Host and confirmation callbacks remain connected; live mutations were not issued. Existing regression tests cover those flows separately.
- Responsive captures at 390 × 844, 320 × 568 and 1440 × 900; no document horizontal overflow. Long names at 320px do not overlap mode/time. Desktop panel remains 498px inner width inside the 500px shell.
- Final fixture console errors/warnings: none. The actual production build's `/search/individual` entry also rendered with no console errors/warnings; capture `production-entry-final.jpg`.

## Automated validation

PR preparation reran `pnpm agent:harness` successfully: all 13 static contracts, 26 app/RPC tests, lint, production build, Edge type checks and 41 Edge tests.

- `pnpm test:app`: 26 passed, 0 failed, including six new address tests. New async/storage cases were observed failing before their corresponding implementation fixes.
- `pnpm agent:harness:quick`: passed all 13 contracts.
- `pnpm lint`: no warnings/errors.
- `pnpm build`: passed lint/type validation and all 11 static pages.
- Prettier check and `git diff --check`: passed.

## Limits and preserved behavior

Live Kakao search, map rendering and backend writes were not verified because local API configuration is absent. The fixture substitutes those boundaries and exercises the real UI/search hook. Existing full-screen sheet focus trapping, generic modal semantics, confirmed-result/nearby-place screens and unavailable global SDK behavior are outside this scoped visual change; this is not a whole-app accessibility certification.

Remaining visual differences are deliberate preservation of the original fonts, flat surfaces, avatar colors and panel height, plus larger touch controls and retained route details. No further polish is required for this change.

final result: passed
