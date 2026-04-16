import { matchAlias, sortRules, AliasRule } from '../../../src/core/matcher';

describe('core/matcher', () => {
  describe('sortRules', () => {
    it('sorts by prefix length descending (longest first)', () => {
      const rules: AliasRule[] = [
        { prefix: '@/', targetPrefix: '', pattern: '@/*' },
        { prefix: '@global/', targetPrefix: 'global/', pattern: '@global/*' }
      ];
      const sorted = sortRules(rules);
      expect(sorted[0].prefix).toBe('@global/');
      expect(sorted[1].prefix).toBe('@/');
    });

    it('does not mutate input array', () => {
      const rules: AliasRule[] = [
        { prefix: '@/', targetPrefix: '', pattern: '@/*' }
      ];
      const snapshot = [...rules];
      sortRules(rules);
      expect(rules).toEqual(snapshot);
    });
  });

  describe('matchAlias', () => {
    const rules: AliasRule[] = sortRules([
      { prefix: '@/', targetPrefix: '', pattern: '@/*' },
      { prefix: '@global/', targetPrefix: 'global/', pattern: '@global/*' }
    ]);

    it('returns null for unmatched request', () => {
      expect(matchAlias('lodash', rules)).toBeNull();
      expect(matchAlias('./relative', rules)).toBeNull();
      expect(matchAlias('../parent', rules)).toBeNull();
      expect(matchAlias('/absolute/path', rules)).toBeNull();
    });

    it('matches single-prefix rule and strips prefix', () => {
      const result = matchAlias('@/modules/wechat/user', rules);
      expect(result).not.toBeNull();
      expect(result!.targetPath).toBe('modules/wechat/user');
      expect(result!.rule.pattern).toBe('@/*');
    });

    it('prefers longest prefix when multiple rules match', () => {
      const result = matchAlias('@global/service/BaseService', rules);
      expect(result).not.toBeNull();
      expect(result!.rule.pattern).toBe('@global/*');
      expect(result!.targetPath).toBe('global/service/BaseService');
    });

    it('returns null when request equals prefix minus trailing slash (no tail)', () => {
      expect(matchAlias('@', rules)).toBeNull();
    });

    it('does not match a request that merely starts with a prefix character', () => {
      expect(matchAlias('@types/node', rules)).toBeNull();
    });
  });
});
