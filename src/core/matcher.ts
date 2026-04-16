/**
 * A single alias rule. Derived from tsconfig.paths but normalized to remove trailing `*`.
 *
 *   paths["@/*"] = ["*"]              → { prefix: "@/", targetPrefix: "", pattern: "@/*" }
 *   paths["@global/*"] = ["global/*"] → { prefix: "@global/", targetPrefix: "global/", pattern: "@global/*" }
 */
export interface AliasRule {
  /** String the request must start with, including any trailing `/`. */
  prefix: string;
  /** String prepended to the matched tail to form the in-outDir relative path. */
  targetPrefix: string;
  /** Original tsconfig paths key, for error messages. */
  pattern: string;
}

export interface MatchResult {
  rule: AliasRule;
  /** Computed target path inside outDir, relative. E.g. "global/service/X". */
  targetPath: string;
}

/**
 * Sort rules by prefix length descending so the first match wins (longest prefix).
 * Does not mutate input.
 */
export function sortRules(rules: readonly AliasRule[]): AliasRule[] {
  return [...rules].sort((a, b) => b.prefix.length - a.prefix.length);
}

/**
 * Match a module request against pre-sorted alias rules.
 * Returns null if no rule matches.
 *
 * Note: rules MUST be sorted by `sortRules` before being passed here.
 */
export function matchAlias(
  request: string,
  rules: readonly AliasRule[]
): MatchResult | null {
  // Fast fail on obvious non-aliases
  if (
    request.length === 0 ||
    request.startsWith('.') ||
    request.startsWith('/')
  ) {
    return null;
  }

  for (const rule of rules) {
    if (request.startsWith(rule.prefix)) {
      const tail = request.slice(rule.prefix.length);
      if (tail.length === 0) continue; // require a non-empty tail after the prefix
      return {
        rule,
        targetPath: rule.targetPrefix + tail
      };
    }
  }
  return null;
}
