import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const NodeModule = require('node:module') as {
  _resolveFilename: (req: string, parent: NodeModule | null) => string;
};

describe('integration/register smoke', () => {
  it('requiring path-alias-plugin/register from a host project installs the hook', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-smoke-'));
    fs.writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: './src',
          outDir: './dist',
          paths: { '@/*': ['*'] }
        }
      })
    );
    fs.mkdirSync(path.join(dir, 'dist/global'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'dist/global/X.js'),
      `module.exports = 42;`
    );

    const originalCwd = process.cwd();
    process.chdir(dir);
    try {
      const registerPath = path.resolve(__dirname, '../../register.js');
      delete require.cache[require.resolve(registerPath)];
      // Also clear cached hook state from any prior tests
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { uninstallHook } = require('../../src/runtime/hook');
      uninstallHook();
      require(registerPath);

      const resolved = NodeModule._resolveFilename('@/global/X', module);
      expect(resolved).toBe(path.join(dir, 'dist/global/X.js'));
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { uninstallHook } = require('../../src/runtime/hook');
      uninstallHook();
      process.chdir(originalCwd);
    }
  });
});
