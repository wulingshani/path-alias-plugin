import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { scanOutputFiles } from '../../../src/transformer/scanner';

function makeDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-scan-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
  }
  return dir;
}

describe('transformer/scanner', () => {
  it('finds files matching configured extensions recursively', async () => {
    const dir = makeDir({
      'a.js': '',
      'nested/b.js': '',
      'nested/deep/c.d.ts': '',
      'ignore.txt': '',
      'x.ts': ''
    });
    const files = await scanOutputFiles(dir, ['.js', '.d.ts'], []);
    const rel = files
      .map((f) => path.relative(dir, f).split(path.sep).join('/'))
      .sort();
    expect(rel).toEqual(['a.js', 'nested/b.js', 'nested/deep/c.d.ts']);
  });

  it('excludes files matching glob patterns', async () => {
    const dir = makeDir({
      'a.js': '',
      'a.test.js': '',
      'sub/b.test.js': '',
      'sub/b.js': ''
    });
    const files = await scanOutputFiles(dir, ['.js'], ['**/*.test.js']);
    const rel = files
      .map((f) => path.relative(dir, f).split(path.sep).join('/'))
      .sort();
    expect(rel).toEqual(['a.js', 'sub/b.js']);
  });

  it('returns empty array when directory does not exist', async () => {
    const files = await scanOutputFiles(
      path.join(os.tmpdir(), 'does-not-exist-' + Date.now()),
      ['.js'],
      []
    );
    expect(files).toEqual([]);
  });

  it('returns absolute paths', async () => {
    const dir = makeDir({ 'a.js': '' });
    const files = await scanOutputFiles(dir, ['.js'], []);
    expect(path.isAbsolute(files[0])).toBe(true);
  });
});
