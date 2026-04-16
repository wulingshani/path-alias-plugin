# path-alias-plugin

Drop-in path alias support for Node.js + TypeScript projects. Write `@/x/y` instead of `../../x/y` — and ship safely through `tsc`, `mwtsc`, `pkg`, Docker, or PM2.

## Why

TypeScript's `paths` field is only for type checking. At runtime, `require('@/x')` fails because `tsc` does not rewrite imports. This plugin closes that gap with **two complementary channels**:

- **Compile-time rewriter** (main channel): After `tsc`/`mwtsc` emits `dist/`, `path-alias build` walks the output, parses each file with the TypeScript AST, and replaces `@/x` with real relative paths. The shipped artifact contains zero aliases — pkg/Docker/PM2 work unchanged.
- **Runtime hook** (fallback): For dev mode where you don't run `build`, `require('path-alias-plugin/register')` patches `Module._resolveFilename` at process start. Auto-disabled under `pkg`.

## Quick Start

1. Install:
   ```bash
   npm install --save-dev path-alias-plugin
   ```

2. Add `baseUrl` + `paths` to your `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "baseUrl": "./src",
       "paths": { "@/*": ["*"] }
     }
   }
   ```

3. Add a build step:
   ```json
   {
     "scripts": {
       "build": "tsc && path-alias build"
     }
   }
   ```

4. Register the runtime hook for dev mode (first line of your entry file):
   ```js
   require('path-alias-plugin/register');
   ```

## Midway.js Integration

`bootstrap.js`:
```js
require('path-alias-plugin/register');
const { Bootstrap } = require('@midwayjs/bootstrap');
Bootstrap.configure({ imports: require('./dist/index') }).run();
```

`package.json`:
```json
{
  "scripts": {
    "build": "cool entity && bundle && mwtsc --cleanOutDir && path-alias build",
    "start:local": "cross-env NODE_OPTIONS=\"-r path-alias-plugin/register\" MIDWAY_SERVER_ENV=local mwtsc --cleanOutDir --watch --run @midwayjs/mock/app.js --keepalive"
  }
}
```

## pkg Compatibility

`path-alias build` produces real relative paths in `dist/`. When `pkg` packages `dist/**/*` into its v8 snapshot, there are no aliases to worry about — all imports resolve statically. The runtime hook auto-disables under `pkg` (detected via `process.pkg`).

If you need the runtime hook inside pkg (uncommon), set:
```json
{ "runtime": { "enabledInPkg": true } }
```
in `path-alias.config.json`.

## CLI

- `path-alias build` — rewrite `dist/`
- `path-alias build --dry-run` — report without writing
- `path-alias check` — validate all alias imports resolve, exit 1 on error
- `path-alias init` — print suggested config edits

## Config Reference

All fields optional. Place `path-alias.config.json` in project root:
```jsonc
{
  "tsconfig":   "./tsconfig.json",
  "outDir":     null,
  "extensions": [".js", ".d.ts"],
  "sourceMap":  true,
  "exclude":    ["**/*.test.js"],
  "silent":     false,
  "runtime": {
    "enabled":      true,
    "enabledInPkg": false
  }
}
```

## FAQ

**Q: Does it support ESM?**
A: v1 core supports CommonJS. An ESM `module.register()` hook is planned. PRs welcome.

**Q: Does it support multi-target `paths` mappings?**
A: v1 uses the first target and warns on additional entries. Multi-target is planned for v2.

**Q: Can I rewrite my existing `../../` imports to aliases in bulk?**
A: Planned as `path-alias migrate` in v1.1. For now, VS Code's global replace works.

## License

MIT
