import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { AliasRule, sortRules } from './matcher';

export type { AliasRule };

export interface RuntimeConfig {
  enabled: boolean;
  enabledInPkg: boolean;
}

export interface Config {
  /** Absolute path to the host project's tsconfig.json we loaded. */
  tsconfigPath: string;
  /** Absolute path to the host project root (directory containing tsconfig). */
  projectRoot: string;
  /** Absolute path resolved from compilerOptions.baseUrl. */
  baseUrl: string;
  /** Absolute path resolved from compilerOptions.outDir. */
  outDir: string;
  /** Absolute path resolved from compilerOptions.rootDir; defaults to baseUrl. */
  rootDir: string;
  /** Alias rules sorted by prefix length desc (longest first). */
  rules: AliasRule[];
  /** File extensions the transformer scans. */
  extensions: string[];
  /** Whether to preserve sourcemaps. */
  sourceMap: boolean;
  /** Glob patterns excluded from rewriting. */
  exclude: string[];
  /** If true, suppress log output. */
  silent: boolean;
  runtime: RuntimeConfig;
}

export interface LoadOptions {
  /** Absolute or relative path to tsconfig.json. Defaults to `<projectRoot>/tsconfig.json`. */
  tsconfig?: string;
  /** Host project root. Defaults to `process.cwd()`. */
  projectRoot?: string;
}

const DEFAULTS = {
  extensions: ['.js', '.d.ts'],
  sourceMap: true,
  exclude: ['**/*.test.js', '**/*.spec.js'],
  silent: false,
  runtime: { enabled: true, enabledInPkg: false }
} as const;

/** Validate a `paths` key/value pair and convert it to an AliasRule. */
function parsePathEntry(key: string, targets: string[]): AliasRule {
  if (!key.endsWith('/*')) {
    throw new Error(
      `[path-alias] pattern "${key}" must end with "/*" (v1 only supports wildcard mappings).`
    );
  }
  if (key.startsWith('.') || key.startsWith('/')) {
    throw new Error(
      `[path-alias] pattern "${key}" must not start with "." or "/".`
    );
  }
  if (targets.length === 0) {
    throw new Error(`[path-alias] pattern "${key}" has no target.`);
  }
  if (targets.length > 1) {
    console.warn(
      `[path-alias] pattern "${key}" has multiple targets; using "${targets[0]}" and ignoring the rest.`
    );
  }
  const target = targets[0];
  if (!target.endsWith('*') && target !== '*') {
    throw new Error(
      `[path-alias] target "${target}" for pattern "${key}" must end with "*".`
    );
  }
  const prefix = key.slice(0, -1); // drop trailing "*"
  const targetPrefix = target === '*' ? '' : target.slice(0, -1);
  return { prefix, targetPrefix, pattern: key };
}

function readTsconfig(
  tsconfigPath: string
): { raw: ts.CompilerOptions; projectDir: string } {
  const projectDir = path.dirname(tsconfigPath);
  const read = ts.readConfigFile(tsconfigPath, (p) =>
    fs.readFileSync(p, 'utf8')
  );
  if (read.error) {
    const msg = ts.flattenDiagnosticMessageText(read.error.messageText, '\n');
    throw new Error(`[path-alias] failed to read ${tsconfigPath}: ${msg}`);
  }
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    projectDir
  );
  // Ignore "No inputs were found in config file" (TS18003) — we only care
  // about compilerOptions, not the actual input files.
  const significantErrors = parsed.errors.filter((e) => e.code !== 18003);
  if (significantErrors.length > 0) {
    const msg = significantErrors
      .map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n'))
      .join('\n');
    throw new Error(`[path-alias] tsconfig errors: ${msg}`);
  }
  return { raw: parsed.options, projectDir };
}

function loadOptionalConfig(projectRoot: string): Partial<Config> {
  const p = path.join(projectRoot, 'path-alias.config.json');
  if (!fs.existsSync(p)) return {};
  const text = fs.readFileSync(p, 'utf8');
  try {
    return JSON.parse(text) as Partial<Config>;
  } catch (e) {
    throw new Error(
      `[path-alias] failed to parse ${p}: ${(e as Error).message}`
    );
  }
}

export function loadConfig(options: LoadOptions = {}): Config {
  const projectRoot = options.projectRoot
    ? path.resolve(options.projectRoot)
    : process.cwd();
  const tsconfigPath = options.tsconfig
    ? path.resolve(projectRoot, options.tsconfig)
    : path.join(projectRoot, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    throw new Error(`[path-alias] tsconfig not found at ${tsconfigPath}`);
  }

  const { raw } = readTsconfig(tsconfigPath);

  if (!raw.baseUrl) {
    throw new Error(
      `[path-alias] compilerOptions.baseUrl is required in ${tsconfigPath}.`
    );
  }
  const baseUrl = path.resolve(projectRoot, raw.baseUrl);
  const outDir = raw.outDir
    ? path.resolve(projectRoot, raw.outDir)
    : baseUrl;
  const rootDir = raw.rootDir
    ? path.resolve(projectRoot, raw.rootDir)
    : baseUrl;

  const paths: Record<string, string[]> =
    (raw.paths as Record<string, string[]>) ?? {};
  const rules = sortRules(
    Object.entries(paths).map(([k, v]) => parsePathEntry(k, v))
  );

  const optional = loadOptionalConfig(projectRoot);

  return {
    tsconfigPath,
    projectRoot,
    baseUrl,
    outDir,
    rootDir,
    rules,
    extensions: optional.extensions ?? [...DEFAULTS.extensions],
    sourceMap: optional.sourceMap ?? DEFAULTS.sourceMap,
    exclude: optional.exclude ?? [...DEFAULTS.exclude],
    silent: optional.silent ?? DEFAULTS.silent,
    runtime: {
      enabled: optional.runtime?.enabled ?? DEFAULTS.runtime.enabled,
      enabledInPkg:
        optional.runtime?.enabledInPkg ?? DEFAULTS.runtime.enabledInPkg
    }
  };
}
