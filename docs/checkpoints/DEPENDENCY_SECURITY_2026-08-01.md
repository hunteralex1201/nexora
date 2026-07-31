# Dependency Security Decision — 2026-08-01

**Status:** Remediation in progress
**Scope:** JavaScript workspace transitive dependencies only

A lockfile audit identified three high-severity findings: one inherited `sharp`/libvips advisory and two PostCSS source-map file-disclosure/path-traversal advisories. The findings originate from transitive versions bundled beneath Next.js 16.2.12; no direct application dependency introduced them.

The GitHub-reviewed Sharp advisory marks versions below 0.35.0 as affected, identifies 0.35.0 as the first patched version, and recommends upgrading to the then-current 0.35.3 release using libvips 8.18.3.[1] The repository therefore pins `sharp` to 0.35.3 through a workspace override.

The GitHub-reviewed PostCSS path-traversal advisory marks versions through 8.5.17 as affected and 8.5.18 as patched.[2] The PostCSS changelog likewise records the 8.5.18 source-map path restriction.[3] The repository therefore pins `postcss` to 8.5.18 through a workspace override, satisfying both detected PostCSS advisories while minimizing compatibility change.

These overrides are acceptable only if the frozen install, complete test suite, Next.js production build, production web image build, and repeated high-severity audit all pass. If any compatibility gate fails, the change must be reverted or replaced with an upstream Next.js release containing equivalent patched dependencies.

## References

[1]: https://github.com/advisories/GHSA-f88m-g3jw-g9cj "GitHub Advisory Database — sharp inherited vulnerabilities in libvips"
[2]: https://github.com/advisories/GHSA-r28c-9q8g-f849 "GitHub Advisory Database — PostCSS path traversal in previous source-map loading"
[3]: https://github.com/postcss/postcss/blob/main/CHANGELOG.md "PostCSS changelog"

## Package-manager and remaining-advisory resolution

The active repository pin was pnpm 9.0.0, while current pnpm places project settings such as `overrides` in the root `pnpm-workspace.yaml`.[4] The maintained pnpm 10 line supports that configuration and remains compatible with Node.js 20; pnpm 10.34.5 declares Node.js 18.12 or newer, whereas pnpm 11.18.0 requires Node.js 22.13 or newer.[5] To preserve the repository’s Node.js 20.9 compatibility boundary, the package-manager pin and CI setup were aligned to pnpm 10.34.5 rather than raising the project’s Node engine solely for package-management reasons.

After the high-severity overrides were enforced, the audit exposed one remaining moderate advisory in the direct `echarts` 5.6.0 dependency (`GHSA-fgmj-fm8m-jvvx`, patched in 6.1.0).[6] Source inspection confirmed that ECharts was declared but unused; it was removed rather than forcing an unnecessary major-version upgrade. The refreshed lockfile then reported **no known vulnerabilities**.

[4]: https://pnpm.io/settings "pnpm settings — root project settings and dependency overrides"
[5]: https://www.npmjs.com/package/pnpm "pnpm package metadata and maintained release lines"
[6]: https://github.com/advisories/GHSA-fgmj-fm8m-jvvx "GitHub Advisory Database — Apache ECharts cross-site scripting vulnerability"
