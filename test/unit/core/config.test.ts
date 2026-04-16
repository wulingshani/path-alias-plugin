import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadConfig } from '../../../src/core/config';

/** Create a throwaway tsconfig project directory. Returns its absolute path. */
function makeProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-cfg-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
  }
  return dir;
}

describe('core/config', () => {
  it('loads a minimal valid tsconfig with @/* → *', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          rootDir: './src',
          paths: { '@/*': ['*'] }
        }
      })
    });
    const cfg = loadConfig({ projectRoot: dir });
    expect(cfg.baseUrl).toBe(path.resolve(dir, 'src'));
    expect(cfg.outDir).toBe(path.resolve(dir, 'dist'));
    expect(cfg.rules).toHaveLength(1);
    expect(cfg.rules[0]).toMatchObject({
      prefix: '@/',
      targetPrefix: '',
      pattern: '@/*'
    });
  });

  it('sorts rules by prefix length descending', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: {
            '@/*': ['*'],
            '@global/*': ['global/*']
          }
        }
      })
    });
    const cfg = loadConfig({ projectRoot: dir });
    expect(cfg.rules[0].prefix).toBe('@global/');
    expect(cfg.rules[1].prefix).toBe('@/');
  });

  it('parses tsconfig with JSONC comments', () => {
    const dir = makeProject({
      'tsconfig.json': `{
        // comment
        "compilerOptions": {
          "baseUrl": "./src",
          "outDir": "./dist",
          "paths": { "@/*": ["*"] }  /* trailing */
        }
      }`
    });
    const cfg = loadConfig({ projectRoot: dir });
    expect(cfg.rules).toHaveLength(1);
  });

  it('throws when baseUrl is missing', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          paths: { '@/*': ['*'] }
        }
      })
    });
    expect(() => loadConfig({ projectRoot: dir })).toThrow(/baseUrl/);
  });

  it('warns and uses first target when paths value has multiple entries', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*', 'fallback/*'] }
        }
      })
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const cfg = loadConfig({ projectRoot: dir });
    expect(cfg.rules[0].targetPrefix).toBe('');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/multiple targets/));
    warn.mockRestore();
  });

  it('rejects paths pattern not ending in /*', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@exact': ['file'] }
        }
      })
    });
    expect(() => loadConfig({ projectRoot: dir })).toThrow(/pattern.*\*/);
  });

  it('merges optional path-alias.config.json', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      }),
      'path-alias.config.json': JSON.stringify({
        extensions: ['.js'],
        silent: true,
        runtime: { enabled: false }
      })
    });
    const cfg = loadConfig({ projectRoot: dir });
    expect(cfg.extensions).toEqual(['.js']);
    expect(cfg.silent).toBe(true);
    expect(cfg.runtime.enabled).toBe(false);
  });

  it('defaults outDir to baseUrl when missing (edge case)', () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          paths: { '@/*': ['*'] }
        }
      })
    });
    const cfg = loadConfig({ projectRoot: dir });
    expect(cfg.outDir).toBe(path.resolve(dir, 'src'));
  });
});
