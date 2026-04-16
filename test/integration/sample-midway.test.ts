import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { loadConfig } from '../../src/core/config';
import { transform } from '../../src/transformer';

/**
 * End-to-end: Given a pre-compiled `dist/` that still contains `@/...` alias
 * imports (simulating the state right after `tsc` / `mwtsc` emit), verify
 * that `transform()` rewrites them to real relative paths and that Node can
 * execute the resulting output.
 *
 * We skip running tsc in-test because doing so requires @types/node be
 * findable in the temp project — an orthogonal concern. Producing the
 * pre-compiled .js directly keeps this test focused on the transform.
 */
describe('integration: sample-midway', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-fixture-'));

    fs.writeFileSync(
      path.join(projectDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      })
    );

    // Pre-compiled output with unrewritten aliases — what mwtsc would emit.
    writeFile(
      projectDir,
      'dist/global/BaseService.js',
      `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseService = void 0;
class BaseService {
  constructor() { this.kind = 'base'; }
}
exports.BaseService = BaseService;
`
    );
    writeFile(
      projectDir,
      'dist/modules/demo/service.js',
      `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemoService = void 0;
const BaseService_1 = require("@/global/BaseService");
class DemoService extends BaseService_1.BaseService {
  greet() { return 'hello from ' + this.kind; }
}
exports.DemoService = DemoService;
`
    );
    writeFile(
      projectDir,
      'dist/index.js',
      `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const service_1 = require("@/modules/demo/service");
const svc = new service_1.DemoService();
process.stdout.write(svc.greet());
`
    );
  });

  it('contains unrewritten aliases before transform', () => {
    const compiled = fs.readFileSync(
      path.join(projectDir, 'dist/modules/demo/service.js'),
      'utf8'
    );
    expect(compiled).toContain('"@/global/BaseService"');
  });

  it('rewrites aliases to real relative paths and the output runs correctly', async () => {
    const cfg = loadConfig({ projectRoot: projectDir });
    const summary = await transform(cfg);
    expect(summary.errors).toEqual([]);
    expect(summary.filesRewritten).toBe(2);

    const service = fs.readFileSync(
      path.join(projectDir, 'dist/modules/demo/service.js'),
      'utf8'
    );
    expect(service).not.toContain('@/global/BaseService');
    expect(service).toContain('../../global/BaseService');

    const output = execFileSync(
      process.execPath,
      [path.join(projectDir, 'dist/index.js')],
      { encoding: 'utf8' }
    );
    expect(output).toBe('hello from base');
  });
});

function writeFile(root: string, rel: string, content: string): void {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}
