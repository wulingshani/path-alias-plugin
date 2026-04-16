# Changelog

## 0.1.0 — 2026-04-16 (initial)

### Added
- Compile-time AST rewriter (`path-alias build`) — rewrites `@/x` to real relative paths in `dist/` with sourcemap preservation.
- Runtime hook (`path-alias-plugin/register`) — patches `Module._resolveFilename` for dev mode; auto-disables under `pkg`.
- CLI commands: `build`, `check`, `init`.
- Single source of truth: reads `tsconfig.json` `paths` directly.
- Optional `path-alias.config.json` for runtime/extension/exclude overrides.
- Integration test against a Midway-style fixture.
- Migration guide for unify-govern.

### Known limitations
- v1 supports only `"<prefix>/*": ["<target>/*"]` form of `paths`.
- ESM support is stub-only (experimental).
- Bulk migration command (`path-alias migrate`) planned for v1.1.
