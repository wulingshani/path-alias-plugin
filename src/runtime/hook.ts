import { Config } from '../core/config';
import { resolveToAbsolute } from '../core/resolver';

// Use require() rather than a namespace import: TypeScript's namespace-import
// for `node:module` yields a getter-only proxy where `_resolveFilename` cannot
// be reassigned. The CommonJS-style require returns the actual Module class
// whose static properties we must patch.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NodeModule = require('node:module') as ModuleClass;

interface ModuleClass {
  _resolveFilename: ResolveFn;
}

type ResolveFn = (
  request: string,
  parent: NodeModule | null,
  ...rest: unknown[]
) => string;

let originalResolve: ResolveFn | null = null;
let activeConfig: Config | null = null;

function isPkg(): boolean {
  return typeof (process as { pkg?: unknown }).pkg !== 'undefined';
}

/**
 * Install the path-alias require hook.
 * No-op if already installed, or if running under pkg with enabledInPkg=false.
 */
export function installHook(config: Config): void {
  if (!config.runtime.enabled) return;
  if (isPkg() && !config.runtime.enabledInPkg) return;
  if (originalResolve !== null) {
    activeConfig = config;
    return;
  }
  originalResolve = NodeModule._resolveFilename;
  activeConfig = config;

  NodeModule._resolveFilename = function patched(
    this: unknown,
    request: string,
    parent: NodeModule | null,
    ...rest: unknown[]
  ): string {
    const cfg = activeConfig;
    if (cfg && isAliasCandidate(request, cfg)) {
      const abs = resolveToAbsolute(request, cfg);
      if (abs !== null) {
        return originalResolve!.call(this, abs, parent, ...rest);
      }
    }
    return originalResolve!.call(this, request, parent, ...rest);
  };
}

/** Restore the original resolver. Safe to call when not installed. */
export function uninstallHook(): void {
  if (originalResolve === null) return;
  NodeModule._resolveFilename = originalResolve;
  originalResolve = null;
  activeConfig = null;
}

/** True if `request` could conceivably match one of the configured aliases. */
function isAliasCandidate(request: string, cfg: Config): boolean {
  if (
    request.length === 0 ||
    request.startsWith('.') ||
    request.startsWith('/') ||
    request.startsWith('node:')
  ) {
    return false;
  }
  for (const rule of cfg.rules) {
    if (request.startsWith(rule.prefix)) return true;
  }
  return false;
}
