import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { installHook, uninstallHook } from '../../../src/runtime/hook';
// Use require so we can observe the mutable Module class, not the
// getter-only TS namespace proxy.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NodeModule = require('node:module') as {
  _resolveFilename: unknown;
};
import { loadConfig } from '../../../src/core/config';

function makeProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-hook-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
  }
  return dir;
}

describe('runtime/hook', () => {
  afterEach(() => {
    uninstallHook();
  });

  it('resolves @/x to absolute path inside outDir', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      }),
      'dist/global/BaseService.js': `module.exports = { name: 'BaseService' };`
    });
    const cfg = loadConfig({ projectRoot: dir });
    installHook(cfg);

    // Call the patched Module._resolveFilename directly. jest's require.resolve
    // goes through jest-resolve and would bypass our hook.
    const resolver = NodeModule._resolveFilename as (
      req: string,
      parent: NodeModule | null
    ) => string;
    const resolved = resolver('@/global/BaseService', module);
    expect(resolved).toBe(path.join(dir, 'dist/global/BaseService.js'));
  });

  it('passes through non-aliased requests untouched', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      })
    });
    const cfg = loadConfig({ projectRoot: dir });
    installHook(cfg);
    expect(() => require.resolve('path')).not.toThrow();
    expect(() => require.resolve('node:fs')).not.toThrow();
  });

  it('is idempotent — install twice does not double-patch', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      })
    });
    const cfg = loadConfig({ projectRoot: dir });
    const before = NodeModule
      ._resolveFilename;
    installHook(cfg);
    const afterFirst = NodeModule
      ._resolveFilename;
    installHook(cfg);
    const afterSecond = NodeModule
      ._resolveFilename;
    expect(afterFirst).not.toBe(before);
    expect(afterSecond).toBe(afterFirst);
  });

  it('uninstall restores original resolver', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      })
    });
    const cfg = loadConfig({ projectRoot: dir });
    const before = NodeModule
      ._resolveFilename;
    installHook(cfg);
    uninstallHook();
    expect(
      NodeModule._resolveFilename
    ).toBe(before);
  });

  it('short-circuits in pkg environment when enabledInPkg is false', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      })
    });
    const cfg = loadConfig({ projectRoot: dir });
    (process as unknown as { pkg?: unknown }).pkg = { version: '5.0.0' };
    try {
      const before = NodeModule
        ._resolveFilename;
      installHook(cfg);
      expect(
        NodeModule._resolveFilename
      ).toBe(before);
    } finally {
      delete (process as unknown as { pkg?: unknown }).pkg;
    }
  });

  it('applies patch in pkg environment when enabledInPkg is true', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      }),
      'path-alias.config.json': JSON.stringify({
        runtime: { enabledInPkg: true }
      })
    });
    const cfg = loadConfig({ projectRoot: dir });
    (process as unknown as { pkg?: unknown }).pkg = { version: '5.0.0' };
    try {
      const before = NodeModule
        ._resolveFilename;
      installHook(cfg);
      expect(
        NodeModule._resolveFilename
      ).not.toBe(before);
    } finally {
      delete (process as unknown as { pkg?: unknown }).pkg;
    }
  });
});
