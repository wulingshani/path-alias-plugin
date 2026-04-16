import * as path from 'node:path';
import {
  resolveToRelative,
  resolveToAbsolute
} from '../../../src/core/resolver';
import { sortRules } from '../../../src/core/matcher';
import { Config } from '../../../src/core/config';

function makeConfig(projectRoot: string): Config {
  return {
    tsconfigPath: path.join(projectRoot, 'tsconfig.json'),
    projectRoot,
    baseUrl: path.join(projectRoot, 'src'),
    outDir: path.join(projectRoot, 'dist'),
    rootDir: path.join(projectRoot, 'src'),
    rules: sortRules([
      { prefix: '@/', targetPrefix: '', pattern: '@/*' }
    ]),
    extensions: ['.js', '.d.ts'],
    sourceMap: true,
    exclude: [],
    silent: true,
    runtime: { enabled: true, enabledInPkg: false }
  };
}

describe('core/resolver', () => {
  const PROJECT = process.platform === 'win32' ? 'D:\\proj' : '/proj';

  describe('resolveToRelative', () => {
    it('returns null for non-aliased requests', () => {
      const cfg = makeConfig(PROJECT);
      expect(
        resolveToRelative('lodash', path.join(PROJECT, 'dist/x.js'), cfg)
      ).toBeNull();
      expect(
        resolveToRelative('./sibling', path.join(PROJECT, 'dist/x.js'), cfg)
      ).toBeNull();
    });

    it('computes correct relative path from deep source to shallow target', () => {
      const cfg = makeConfig(PROJECT);
      const from = path.join(
        PROJECT,
        'dist/modules/wechat/service/UserService.js'
      );
      const rel = resolveToRelative('@/global/service/BaseService', from, cfg);
      expect(rel).toBe('../../../global/service/BaseService');
    });

    it('returns "./" prefix when target is in same directory', () => {
      const cfg = makeConfig(PROJECT);
      const from = path.join(PROJECT, 'dist/global/service/X.js');
      const rel = resolveToRelative('@/global/service/Y', from, cfg);
      expect(rel).toBe('./Y');
    });

    it('always uses forward slashes (posix) regardless of platform', () => {
      const cfg = makeConfig(PROJECT);
      const from = path.join(PROJECT, 'dist/a/b/c/d.js');
      const rel = resolveToRelative('@/x/y', from, cfg);
      expect(rel).not.toContain('\\');
      expect(rel).toBe('../../../x/y');
    });

    it('handles empty tail correctly (should not match)', () => {
      const cfg = makeConfig(PROJECT);
      expect(
        resolveToRelative('@/', path.join(PROJECT, 'dist/x.js'), cfg)
      ).toBeNull();
    });
  });

  describe('resolveToAbsolute', () => {
    it('returns null for non-aliased requests', () => {
      const cfg = makeConfig(PROJECT);
      expect(resolveToAbsolute('react', cfg)).toBeNull();
    });

    it('returns absolute path inside outDir', () => {
      const cfg = makeConfig(PROJECT);
      const abs = resolveToAbsolute('@/global/service/BaseService', cfg);
      expect(abs).toBe(
        path.join(PROJECT, 'dist/global/service/BaseService')
      );
    });
  });
});
