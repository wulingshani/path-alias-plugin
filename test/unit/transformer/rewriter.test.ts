import * as path from 'node:path';
import { rewriteImports, Edit } from '../../../src/transformer/rewriter';
import { sortRules } from '../../../src/core/matcher';
import { Config } from '../../../src/core/config';

const PROJECT = process.platform === 'win32' ? 'D:\\proj' : '/proj';

function cfg(): Config {
  return {
    tsconfigPath: path.join(PROJECT, 'tsconfig.json'),
    projectRoot: PROJECT,
    baseUrl: path.join(PROJECT, 'src'),
    outDir: path.join(PROJECT, 'dist'),
    rootDir: path.join(PROJECT, 'src'),
    rules: sortRules([{ prefix: '@/', targetPrefix: '', pattern: '@/*' }]),
    extensions: ['.js', '.d.ts'],
    sourceMap: true,
    exclude: [],
    silent: true,
    runtime: { enabled: true, enabledInPkg: false }
  };
}

function from(relative: string): string {
  return path.join(PROJECT, 'dist', relative);
}

describe('transformer/rewriter', () => {
  it('rewrites CommonJS require() calls', () => {
    const source = `const x = require("@/global/service/BaseService");`;
    const result = rewriteImports(
      source,
      from('modules/wechat/service/UserService.js'),
      cfg()
    );
    expect(result.output).toBe(
      `const x = require("../../../global/service/BaseService");`
    );
    expect(result.edits).toHaveLength(1);
  });

  it('rewrites ESM import declarations', () => {
    const source = `import { X } from "@/global/X";\n`;
    const result = rewriteImports(source, from('a.js'), cfg());
    expect(result.output).toBe(`import { X } from "./global/X";\n`);
  });

  it('rewrites export ... from declarations', () => {
    const source = `export * from "@/global/X";`;
    const result = rewriteImports(source, from('a.js'), cfg());
    expect(result.output).toBe(`export * from "./global/X";`);
  });

  it('rewrites dynamic import()', () => {
    const source = `const m = import("@/global/X");`;
    const result = rewriteImports(source, from('a.js'), cfg());
    expect(result.output).toBe(`const m = import("./global/X");`);
  });

  it('rewrites import type from .d.ts', () => {
    const source = `export type T = import("@/global/X").Y;`;
    const result = rewriteImports(source, from('a.d.ts'), cfg());
    expect(result.output).toBe(`export type T = import("./global/X").Y;`);
  });

  it('does not rewrite strings inside comments', () => {
    const source = `// import "@/global/X";\nconst x = 1;`;
    const result = rewriteImports(source, from('a.js'), cfg());
    expect(result.output).toBe(source);
    expect(result.edits).toHaveLength(0);
  });

  it('does not rewrite string literals that are not import specifiers', () => {
    const source = `const msg = "require('@/x')"; const y = 1;`;
    const result = rewriteImports(source, from('a.js'), cfg());
    expect(result.output).toBe(source);
  });

  it('does not rewrite template literals', () => {
    const source = 'const x = `@/global/X`;';
    const result = rewriteImports(source, from('a.js'), cfg());
    expect(result.output).toBe(source);
  });

  it('is idempotent: rewritten output produces no further edits', () => {
    const source = `const x = require("@/global/X");`;
    const first = rewriteImports(source, from('modules/y.js'), cfg());
    const second = rewriteImports(first.output, from('modules/y.js'), cfg());
    expect(second.output).toBe(first.output);
    expect(second.edits).toHaveLength(0);
  });

  it('preserves quote style (single vs double)', () => {
    const source = `const x = require('@/global/X');`;
    const result = rewriteImports(source, from('modules/y.js'), cfg());
    expect(result.output).toBe(`const x = require('../global/X');`);
  });

  it('preserves surrounding code verbatim including whitespace and comments', () => {
    const source = `// leading comment\nimport {\n  A,\n  B\n} from "@/global/X";   // inline\nconst y = 1;\n`;
    const result = rewriteImports(source, from('a.js'), cfg());
    expect(result.output).toBe(
      `// leading comment\nimport {\n  A,\n  B\n} from "./global/X";   // inline\nconst y = 1;\n`
    );
  });

  it('handles multiple imports in one file', () => {
    const source = `const a = require("@/a");\nconst b = require("@/b/c");\nconst lodash = require("lodash");`;
    const result = rewriteImports(source, from('modules/x.js'), cfg());
    expect(result.output).toBe(
      `const a = require("../a");\nconst b = require("../b/c");\nconst lodash = require("lodash");`
    );
    expect(result.edits).toHaveLength(2);
  });

  it('returns edits with correct offsets for sourcemap consumers', () => {
    const source = `const x = require("@/a");`;
    const result = rewriteImports(source, from('modules/y.js'), cfg());
    const edit: Edit = result.edits[0];
    expect(edit.start).toBeGreaterThanOrEqual(18);
    expect(edit.end).toBeLessThanOrEqual(24);
    expect(edit.originalText).toBe('"@/a"');
    expect(edit.newText).toBe('"../a"');
  });
});
