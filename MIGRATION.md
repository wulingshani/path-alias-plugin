# Migrating unify-govern to path-alias-plugin

This guide walks through adopting `path-alias-plugin` in `D:\project\unify\unify-govern` without breaking any of its 244 existing files.

## Phase 1: Install + Configure (zero business code changes)

### 1.1 Add the plugin as a local dependency

Edit `unify-govern/package.json`:
```json
{
  "devDependencies": {
    "path-alias-plugin": "file:../path-alias-plugin"
  }
}
```

Run:
```bash
cd unify-govern
pnpm install
```

### 1.2 Add `baseUrl` + `paths` to tsconfig

Edit `unify-govern/tsconfig.json`, adding these fields to `compilerOptions`:
```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": { "@/*": ["*"] }
  }
}
```

### 1.3 Register the runtime hook in bootstrap.js

Edit `unify-govern/bootstrap.js`, make the first line:
```js
require('path-alias-plugin/register');
const { Bootstrap } = require('@midwayjs/bootstrap');
Bootstrap.configure({
  imports: require('./dist/index'),
  moduleDetector: false,
}).run();
```

### 1.4 Add `path-alias build` to the build script

Edit `unify-govern/package.json`:
```json
{
  "scripts": {
    "build": "cool entity && bundle && mwtsc --cleanOutDir && path-alias build && npm run copy:migrations"
  }
}
```

### 1.5 Add `-r path-alias-plugin/register` to dev scripts

```json
{
  "scripts": {
    "start:local": "rimraf src/index.ts && cool check && cross-env NODE_OPTIONS=\"-r path-alias-plugin/register\" MIDWAY_SERVER_ENV=local mwtsc --cleanOutDir --watch --run @midwayjs/mock/app.js --keepalive"
  }
}
```

### 1.6 Verify with all three execution modes

```bash
# Production mode
pnpm build && node bootstrap.js
# Dev mode
pnpm start:local
# pkg bundle
pnpm pkg
```

All 244 existing `../../` imports continue to work — they are native relative paths and the plugin never touches them.

## Phase 2: Pilot on one file

Edit `src/modules/wechat/service/UserService.ts`. Change:
```typescript
import { WX_SUBSCRIBE_SCENE, GENDER_TYPE } from './../../../global/enum/wxEnum';
import { BaseService } from '../../../global/service/BaseService';
```
to:
```typescript
import { WX_SUBSCRIBE_SCENE, GENDER_TYPE } from '@/global/enum/wxEnum';
import { BaseService } from '@/global/service/BaseService';
```

Re-run the three execution modes from 1.6 and confirm UserService still loads.

## Phase 3: Bulk migration (optional)

Planned for `path-alias migrate` in v1.1. Meanwhile: VS Code's regex find-replace:

- Find: `from ['"]\.\./{2,}(.+?)['"]`
- Replace: `from '@/$1'`

(Only valid from files under `src/modules/*/*/`. Review the diff carefully.)

## Rollback

Remove the 4 changes in reverse order. The plugin leaves no on-disk artifacts that can't be rebuilt by `rm -rf dist && pnpm build`.
