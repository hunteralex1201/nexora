# Phase 0 Dependency Decisions

**Reviewed:** 2026-08-01
**Author:** Manus AI

## Next.js

NEXORA’s approved stack requires the current stable Next.js release. The existing repository uses Next.js `^14.1.0`, which is outside the currently supported release lines and therefore should not be retained for a new production-grade foundation.

The official Next.js July 2026 security release states that `16.2.x` is the **Active LTS** line and instructs applications to apply the security patch released for that line. The npm package registry reports `16.2.12` as the latest stable package release. Phase 0 will therefore target **Next.js 16.2.12**, with the matching `eslint-config-next` version and the React version required by that stable line. Node.js 22 in the current environment satisfies the Next.js 16 minimum runtime requirement.

This upgrade remains scoped to the foundation: the application continues to use the App Router and existing visual direction, while deprecated `next lint` usage is replaced by direct ESLint execution. No canary or preview dependency will be introduced.

## Sources

[1]: https://nextjs.org/blog/july-2026-security-release "Next.js — July 2026 Security Release"
[2]: https://www.npmjs.com/package/next "npm Registry — next package"
