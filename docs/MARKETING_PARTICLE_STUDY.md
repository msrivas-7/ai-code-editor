# CodeTutor homepage: glyph-field redesign

Status: design approved by the user on 2026-09-07; production integration and
local validation complete. PR review, CI, merge and production verification remain.

PR: [#50](https://github.com/msrivas-7/CodeTutor-AI/pull/50). Initial E2E run had
three flaky jobs (onboarding fixture 500, share-button stability, Escape timing);
only the failed jobs were rerun once and the rerun passed. Review identified
UX-196 below. The user approved fixing the pre-existing Windows assertion and
CI failure masking in this PR. All platforms retain real-filesystem checks for
no mutation of existing paths and chmod only on newly created directories;
Linux/macOS retain exact POSIX mode assertions. Build/test jobs use explicit
fail-fast Bash, with native-command and pipeline negative controls on each OS.
Local backend suite (1424 passed, 29 existing skips), typecheck, baseline and
governance checks, four shell regressions and actionlint pass; hosted Windows
confirmation is required before merge.

Experiment harness: `1692c52e-76b0-4fa4-ae20-a334eb578724`.
Branch-bound release harness: `79523664-9004-44ba-97b6-6ad58d64c4e2`.
Evidence: `.agent-harness/browser-evidence/1692c52e-76b0-4fa4-ae20-a334eb578724/`.

## Scope and release gates

Redesign the public homepage only. Preserve the headline, acquisition and returning
learner destinations, account options, footer links and public metadata.
Editor, lessons, welcome, auth, admin, backend, AI behavior and quotas stay unchanged.
Both the lightweight public router and the already-loaded full app use the same
homepage. The local `?motionStudy=1` link still works but no longer gates the design.

The user approved taking the design through thorough validation, a published PR,
Codex review and resolution of actionable threads, green CI, merge, deployment,
then actual-browser production verification. Earlier local-only restrictions are
superseded by that explicit authorization. A green unit suite alone is insufficient.

## Approved experience

- One continuous original code-glyph field on a near-black page. Ice-blue, amber,
  violet and white light come from the particles, not a blue background wash.
- A large centered bracket hero disperses into the margins while text is read.
  The field regroups centrally between sections; no assembled side illustrations.
- Numerous tiny fragments, readable glyphs and rare large highlights. Size, symbol
  and palette use independent seeded channels; largest sprites are not all pluses.
- Persistent faint atmosphere also drifts and responds to the pointer.
- Swept mouse paths impart momentum. Circular gestures add subtle swirl, followed
  by gentle recovery; drag/arrow rotation is separate and bounded.
- Manual Read / Ask / Check demonstration follows one average-score mistake,
  useful tutor hint, correction and learner explanation. It is explicitly labeled
  illustrative, not a live AI response or execution.
- The header contains only brand and sign-in/dashboard navigation. Local testing
  controls, density selector, theme toggle and free/card/time fine print are gone.
- The user chose system Reduce Motion handling instead of a pause button after
  comparing Astra. Reduced-motion and compact layouts show static original glyphs.
  The public composition stays dark under either system color preference.

The hero is deliberately more cinematic than the baseline. On a 960×863 viewport,
the primary CTA follows the artwork below the first screen; there is no scroll
lock, forced delay or interaction gate. This approved hierarchy change must be
called out in the PR. It is not a measured conversion improvement.

## Reference research

[OpenAI GPT-6 Astra](https://openai.com/index/gpt-6-astra/) was inspected through
actual Codex in-app scrolling from hero to footer, representative demo tabs,
pointer sweeps/circles, drag/arrow controls and reduced-motion emulation.

| Observation | Transferable principle |
| --- | --- |
| Luminous 6, cursor and later blossom, rather than a shape for every paragraph | Give important chapters meaningful visual markers |
| Sculptures disperse around reading content; faint particles remain | Coordinate one field around attention, not separate decorative widgets |
| Wide demos alternate with narrower explanation and manual tabs | Keep evidence legible and pacing under visitor control |
| Pointer movement and whole-form rotation behave differently | Separate local momentum from sculpture rotation |
| Footnotes/footer become quieter | Continuity need not mean identical intensity everywhere |

Loaded public code identifies Next.js, Three.js, React Three Fiber, custom GLSL,
shape samples, pointer-motion/coasting state and renderer quality limits. It also
contains postprocessing integration; presence does not prove every option runs.
Public build artifacts inspected through browser DevTools:

- [Astra geometry/shader](https://openai.com/_next/static/immutable/chunks/1rfzm7jt1igp4.js)
- [Configuration/React integration](https://openai.com/_next/static/immutable/chunks/1kdmy-p0oag4x.js)
- [Three renderer](https://openai.com/_next/static/immutable/chunks/1a43l2lhrwu30.js)
- [Postprocessing integration](https://openai.com/_next/static/immutable/chunks/2_rkuko8hans4.js)

These are version-specific evidence, not stable APIs. One direct HTTP request met
a protection challenge; research used already-loaded public scripts, without
bypass. No reference code, shapes or assets are copied into this implementation.

### Reduced motion: verified

Astra exposes replay and drag/arrow rotation, but no particle pause toggle. With
`prefers-reduced-motion: reduce` emulated and the page reloaded, its hero remains
visible but static. Screenshots across pointer sweeps were byte-identical. The
loaded component gates continuous scene rendering and scroll effects on that
preference and resets pointer state. Clearing it restores changing frames.
Screenshot: `astra-reduced-motion.png`. This does not audit every embedded video
or establish whole-site accessibility compliance.

## Architecture and alternatives

| Choice | Rationale |
| --- | --- |
| Direct Three.js Points and original glyph atlas | One scene/draw call, not a DOM element per glyph |
| DOM-derived scroll keyframes | Reversible native scrolling; no scroll hijacking |
| 420 foreground + 630 ambient glyphs, capped DPR 1.5 | Current visual choice; not claimed as an optimized device-independent density |
| Four morph targets | Brackets, book, conversation and check reinforce programming/learning |
| Per-glyph velocity and damped return | Cursor gestures feel carried rather than radially repelled |
| Static SVG fallback, lazy renderer | Text and acquisition remain available before graphics load or after failure |
| Manual demo tabs | No timed content replacement while someone reads |
| Shared production homepage in both routers | Direct visits and returns from the editor cannot show different designs |

CSS/Framer Motion remain suited to ordinary DOM effects, but not a separate node
for every particle. React Three Fiber adds no needed capability for this single
scene; raw WebGL/WebGPU adds engine responsibility without demonstrated benefit.
No bloom/postprocessing is needed. Three's scene/math core is packaged separately
from WebGL renderer code, behind the lazy renderer boundary; budgets remain intact.

Rejected through user/browser feedback: disconnected side sculptures, dust-only
particles, correlated large-plus symbols, radial repulsion, and local testing
chrome. The current curvature refinement adds up to 40% carry only to curved
strokes; straight sweeps retain the preceding response. Deterministic tests cover
clockwise/counterclockwise direction, release, distant particles and long frames.

References: [Three batching](https://threejs.org/manual/en/optimize-lots-of-objects.html),
[resource cleanup](https://threejs.org/manual/en/cleanup.html),
[rendering on demand](https://threejs.org/manual/en/rendering-on-demand.html),
[WCAG pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html),
[animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
The user-approved preference-based approach has no independent on-page stop
mechanism. Matching Astra does not itself prove WCAG conformance.

## Verification ledger

Actual-browser observations use rebuilt Docker frontend images, not Playwright
as a substitute. CI-oriented automation supplements those interactions.

| Check | Evidence / state |
| --- | --- |
| Reference and baseline | Full reference scroll, targeted gestures and reduced motion; original hero/header/footer compared before activation |
| Centered continuity | Production-route and optimized-build hero, forward/reverse scroll and walkthrough verified; UX-195 tall-screen initial dispersion corrected and rechecked at 1440×1320 |
| Keyboard | Corrected DOM order: header → artwork → CTA; arrows and Tab exit work; Ask → Tab/Space → Check works |
| Responsive | 390×844 and 320×740 have no document overflow and all stages work; code fits at 320; 768×900 restores one canvas |
| Theme/reduced motion | Light system preference preserves intended dark composition; reduce removes canvas/rotation and keeps SVGs; clearing it restores one ready canvas |
| Graphics recovery | Optimized build: blocked graphics download leaves Read/Ask/Check usable, Reload recovers; context loss leaves demo usable, Retry restores rendering and focuses headline; automatic restoration also exercised locally |
| Public controls | No testing controls or pause; footer destinations restored; actual Continue → dashboard → sign-out → Privacy → home → anonymous first lesson → skip intro/welcome reaches enabled editor controls |
| Automated | Full frontend suite: 569 tests; typecheck/build; 16 homepage + zero-state first-journey E2E checks passed with retries disabled |
| Performance | Lighthouse homepage performance 0.98, LCP 2104 ms, CLS 0, TBT 0; why-not page 0.99/LCP 1955 ms. Local optimized desktop sample: 60 frame intervals, median 16.7 ms, p95 16.8 ms, max 17.5 ms at 1280×720/DPR 2 (renderer cap 1.5) |
| PR/release | PR #50 published; initial CI and failed-job E2E rerun green. UX-196 and approved Windows CI correction below; final-head CI/review, production deployment and browser confirmation remain pending. |

Review images, captured from the optimized local build without changing page content:
[hero](images/marketing-redesign/hero.png) and
[walkthrough](images/marketing-redesign/walkthrough.png).
Harness evidence additionally includes `optimized-mobile-320.png`,
`optimized-reduced-motion.png`, `final-desktop-check.png` and
`astra-reduced-motion.png`. Earlier `public-preview-*` images show superseded UI.
The harness audit binds this evidence to the staged code fingerprint; the PR
identifies its commit. These are local-build images, not production proof.

The first production integration hit the unchanged 120 KB per-chunk gzip budget:
graphics chunk 131,439 bytes; all JS 632,053 bytes, below the 700 KB total budget.
Splitting the actual Three package core from its WebGL renderer corrected the
packaging without raising limits. After UX-196, all-JS gzip is 633,954 bytes; largest chunk
90,513 bytes; CSS 19,657 bytes; HTML 1,193 bytes. Both graphics chunks remain lazy,
and their successful load/render was verified in the optimized build.
Development-server timings are not production payload benchmarks; the brief
desktop frame sample is not GPU time, sustained load or low-end-device proof.

### Finding added during final validation

- **UX-195 — tall viewport disperses the hero before scrolling:** closed locally.
  A negative scroll anchor placed the initial sculpture in its departure phase.
  Clamp shape anchors to reachable scroll positions; regression covers 720,
  1000 and 1320px viewport heights. Actual 1440×1320 browser replay confirms a
  complete initial bracket form; production confirmation remains required.
- **UX-196 — focused artwork disappears during motion interruption:** reviewer
  finding, reproduced locally (active element became BODY). The media-query and
  renderer-status transitions now hand focus to the stable headline before
  removing the artwork control, but leave focus elsewhere untouched. Regression
  coverage includes reduced motion, compact resize, context loss and the next
  Tab to the first-lesson action. Actual in-app browser checks passed all three
  interruption paths, Retry recovery, and preserving Check-stage focus when
  changing motion preferences. Full frontend 569 tests, build/typecheck, budgets
  and all 17 marketing E2E checks passed with retries disabled. Release harness
  `e9ca7c5e-8ee8-4b33-8f45-57c63eb587c5` holds browser evidence; production
  confirmation remains required.

## Completion checklist

- [x] Reference behavior and public implementation researched.
- [x] Original glyph design iterated with the user.
- [x] Explicit design and conditional release approval recorded.
- [x] Substantial local browser evidence and deterministic checks.
- [x] Final production-route browser pass, screenshots and performance checks.
- [x] Full relevant automated checks and asset budgets green.
- [x] Independent reader review, clean initial diff, harness and commit.
- [ ] Published PR, clear Codex review, actionable threads resolved, green CI.
- [ ] Merge, successful deployment, deployed-site browser verification.
