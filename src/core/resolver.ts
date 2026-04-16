import * as path from 'node:path';
import { matchAlias } from './matcher';
import { Config } from './config';

/** Convert any platform-native separator to posix "/". */
function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/** Ensure result begins with "./" or "../" as Node's require() requires. */
function ensureRelativePrefix(rel: string): string {
  if (rel === '') return './';
  if (rel.startsWith('.')) return rel;
  return './' + rel;
}

/**
 * Returns a posix relative path from `fromFile`'s directory to the aliased target inside outDir.
 * Returns null if the request doesn't match any alias rule.
 *
 * Intended for use inside the compile-time transformer — the returned path is what goes
 * into the rewritten require/import string literal.
 */
export function resolveToRelative(
  request: string,
  fromFile: string,
  config: Config
): string | null {
  const match = matchAlias(request, config.rules);
  if (!match) return null;
  const absTarget = path.resolve(config.outDir, match.targetPath);
  const fromDir = path.dirname(path.resolve(fromFile));
  const rel = path.relative(fromDir, absTarget);
  return ensureRelativePrefix(toPosix(rel));
}

/**
 * Returns the absolute filesystem path inside outDir for an aliased request.
 * Returns null if the request doesn't match any alias rule.
 *
 * Intended for use by the runtime hook — the returned path is fed back into
 * Node's native Module._resolveFilename for final extension/index resolution.
 */
export function resolveToAbsolute(
  request: string,
  config: Config
): string | null {
  const match = matchAlias(request, config.rules);
  if (!match) return null;
  return path.resolve(config.outDir, match.targetPath);
}
