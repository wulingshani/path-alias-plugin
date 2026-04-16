import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Recursively walks `dir` and returns absolute file paths matching any of the given extensions.
 * Files matching any excludePatterns (posix glob-lite) are skipped.
 *
 * Returns [] if dir does not exist.
 */
export async function scanOutputFiles(
  dir: string,
  extensions: readonly string[],
  excludePatterns: readonly string[]
): Promise<string[]> {
  let stat;
  try {
    stat = await fs.stat(dir);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) return [];

  const exts = new Set(extensions.map((e) => e.toLowerCase()));
  const excludeRegexes = excludePatterns.map(globToRegex);
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          return;
        }
        if (!entry.isFile()) return;
        if (!matchesExtension(entry.name, exts)) return;
        const posixRel = path.relative(dir, full).split(path.sep).join('/');
        if (excludeRegexes.some((re) => re.test(posixRel))) return;
        results.push(full);
      })
    );
  }

  await walk(dir);
  return results.sort();
}

function matchesExtension(name: string, exts: Set<string>): boolean {
  const lower = name.toLowerCase();
  for (const ext of exts) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

/**
 * Converts a minimal glob (supports `**`, `*`, `?`) to an anchored RegExp.
 * Keeps the implementation zero-dep.
 */
function globToRegex(glob: string): RegExp {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i += 2;
      if (glob[i] === '/') i++;
      continue;
    }
    if (c === '*') {
      re += '[^/]*';
      i++;
      continue;
    }
    if (c === '?') {
      re += '[^/]';
      i++;
      continue;
    }
    if ('.+^$(){}[]|\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
    i++;
  }
  return new RegExp('^' + re + '$');
}
