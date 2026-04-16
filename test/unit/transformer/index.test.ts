import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { transform } from '../../../src/transformer';
import { loadConfig } from '../../../src/core/config';

function makeProject(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-xform-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
  }
  return dir;
}

describe('transformer orchestrator', () => {
  it('rewrites alias imports across all files in outDir', async () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      }),
      'dist/modules/x.js': `const s = require("@/global/Y");`,
      'dist/global/Y.js': `module.exports = { hello: 1 };`
    });
    const cfg = loadConfig({ projectRoot: dir });
    const summary = await transform(cfg);

    expect(summary.filesScanned).toBe(2);
    expect(summary.filesRewritten).toBe(1);
    expect(summary.editCount).toBe(1);

    const rewritten = fs.readFileSync(
      path.join(dir, 'dist/modules/x.js'),
      'utf8'
    );
    expect(rewritten).toBe(`const s = require("../global/Y");`);
  });

  it('leaves files with no aliases unchanged (no write, no mtime bump)', async () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      }),
      'dist/untouched.js': `const x = require("lodash");`
    });
    const target = path.join(dir, 'dist/untouched.js');
    const mtimeBefore = fs.statSync(target).mtimeMs;
    await new Promise((r) => setTimeout(r, 10));
    const cfg = loadConfig({ projectRoot: dir });
    await transform(cfg);
    const mtimeAfter = fs.statSync(target).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });

  it('returns errors for aliases whose target does not exist on disk', async () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      }),
      'dist/modules/x.js': `const s = require("@/does/not/exist");`
    });
    const cfg = loadConfig({ projectRoot: dir });
    const summary = await transform(cfg);
    expect(summary.errors.length).toBeGreaterThan(0);
    expect(summary.errors[0].message).toMatch(/dangling|not exist|not found/i);
  });

  it('respects dryRun: writes nothing but reports what would happen', async () => {
    const dir = makeProject({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      }),
      'dist/global/Y.js': ``,
      'dist/a.js': `const x = require("@/global/Y");`
    });
    const target = path.join(dir, 'dist/a.js');
    const original = fs.readFileSync(target, 'utf8');
    const cfg = loadConfig({ projectRoot: dir });
    const summary = await transform(cfg, { dryRun: true });
    expect(summary.filesRewritten).toBe(1);
    expect(fs.readFileSync(target, 'utf8')).toBe(original);
  });
});
