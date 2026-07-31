# Phase 0 Visual Validation

**Validation date:** 2026-08-01 (GMT+6)

## Production-image browser review

The production web image was opened at `http://127.0.0.1:3000` while the production API image and its PostgreSQL and Redis dependencies were running locally.

| Surface | Result | Evidence |
|---|---|---|
| Landing page | Pass | The NEXORA brand, Phase 0 label, primary commerce-intelligence message, blueprint panel, honest no-live-data notice, and foundation cards rendered without clipping or obvious overlap at the 892 × 768 review viewport. |
| Sign-in page | Pass | The email and password fields, visible labels, minimum-password guidance, secure-submit action, HTTP-only-cookie notice, skip link, and home link rendered clearly without overflow. |
| Content integrity | Pass | The page explicitly labels the implementation as an engineering foundation and does not present fabricated marketplace metrics or live-data claims. |
| Keyboard/a11y structure | Pass at review level | A skip link, semantic heading, explicit field labels, descriptive input types, and clearly named links and buttons were exposed in the browser accessibility extraction. Automated component accessibility checks also passed in the frontend test suite. |
| Responsive behavior | Pass at desktop review size | The hero and blueprint use a balanced two-column layout; the sign-in card remains centered and fully visible. Additional small-viewport behavior is covered by responsive CSS and will be included in the final browser/runtime checkpoint. |

## Captured artifacts

- Landing screenshot: `/home/ubuntu/screenshots/127_0_0_1_2026-07-31_21-38-09_3474.webp`
- Sign-in screenshot: `/home/ubuntu/screenshots/127_0_0_1_2026-07-31_21-38-18_4467.webp`

These sandbox paths are validation evidence and are not product assets.

## Authentication redirect regression retest

After rebuilding the production image with relative same-origin redirects, the sign-in page was reopened at `http://127.0.0.1:3000/login`. The form retained its labelled controls, secure-session guidance, centered layout, and complete viewport fit. The isolated smoke-test credentials were accepted by the form controls without client-side rendering errors. Submission, session-cookie retention, and protected-page rendering are validated in the following runtime checkpoint.

## Authenticated overview checkpoint

The corrected login submission succeeded and remained on `http://127.0.0.1:3000`, proving the HTTP-only session cookie survived the redirect. The browser opened `/overview`, and the accessibility extraction exposed the complete protected navigation and page content.

A **visual defect remains open**: at the 892 × 768 viewport, the fixed sidebar renders correctly but the main overview content is persistently blank at the top of the page even after hydration, while the browser reports 1,098 pixels of content below the viewport. This is not accepted as a pass. The layout and generated CSS must be inspected and corrected before Phase 0 validation can complete.

- Authenticated overview screenshot: `/home/ubuntu/screenshots/127_0_0_1_2026-07-31_21-44-47_1611.webp`

## Corrected protected workspace validation

The desktop-shell defect was corrected by making the root application shell a flex row at the same `lg` breakpoint where the sidebar becomes sticky. A component regression assertion now preserves that relationship.

| Protected surface | Result | Evidence |
|---|---|---|
| Overview | Pass | Main content renders at the top of the viewport beside the sidebar, with no blank 100vh offset, overlap, or clipping. The complete foundation snapshot, evidence pathway, partial-state warning, and honest empty state are visible. |
| System | Pass | The live readiness contract renders `Core ready`; API is reachable, PostgreSQL and Redis are healthy, while MinIO and Qdrant remain truthfully labelled `Not probed` and `Configured only`. No connection URL, password, or credential is exposed. |
| Session continuity | Pass | The protected navigation remains authenticated across a production-image restart and route transition on the original `127.0.0.1` host. |

- Corrected overview screenshot: `/home/ubuntu/screenshots/127_0_0_1_2026-07-31_21-46-50_4048.webp`
- Live system screenshot: `/home/ubuntu/screenshots/127_0_0_1_2026-07-31_21-47-01_2038.webp`

## Settings and logout validation

| Surface or action | Result | Evidence |
|---|---|---|
| Settings | Pass | The protected page renders security boundaries, server-controlled session duration, disabled Phase 0 controls, unconfigured integrations, and explicit secret-handling guidance without exposing any credential value. |
| Logout | Pass | Submitting the sign-out form clears the protected session and returns to `http://127.0.0.1:3000/login`; the browser host no longer changes to the container listener address. |

- Settings screenshot: `/home/ubuntu/screenshots/127_0_0_1_2026-07-31_21-47-20_2340.webp`
- Post-logout screenshot: `/home/ubuntu/screenshots/127_0_0_1_2026-07-31_21-47-36_3631.webp`

All browser-discovered defects in the Phase 0 shell have now been corrected and revalidated.
