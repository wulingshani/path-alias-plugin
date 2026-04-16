import * as fs from 'node:fs/promises';
import * as fssync from 'node:fs';
import * as path from 'node:path';
import { RawSourceMap } from 'source-map';
import { Config } from '../core/config';
import { scanOutputFiles } from './scanner';
import { rewriteImports, RewriteResult } from './rewriter';
import { adjustSourceMap } from './sourcemap';
import { resolveToRelative } from '../core/resolver';

export interface TransformOptions {
  dryRun?: boolean;
  /** Max files rewritten in parallel. Default 32. */
  concurrency?: number;
}

export interface TransformError {
  file: string;
  request: string;
  message: string;
}

export interface TransformSummary {
  filesScanned: number;
  filesRewritten: number;
  editCount: number;
  errors: TransformError[];
  durationMs: number;
}

const DEFAULT_CONCURRENCY = 32;

export async function transform(
  config: Config,
  options: TransformOptions = {}
): Promise<TransformSummary> {
  const start = Date.now();
  const files = await scanOutputFiles(
    config.outDir,
    config.extensions,
    config.exclude
  );
  const errors: TransformError[] = [];
  let filesRewritten = 0;
  let editCount = 0;

  const queue = [...files];
  const workers: Promise<void>[] = [];
  const conc = options.concurrency ?? DEFAULT_CONCURRENCY;
  for (let i = 0; i < Math.min(conc, queue.length); i++) {
    workers.push(runWorker());
  }
  await Promise.all(workers);

  async function runWorker(): Promise<void> {
    while (queue.length) {
      const file = queue.shift();
      if (file === undefined) return;
      await processOne(file);
    }
  }

  async function processOne(file: string): Promise<void> {
    const source = await fs.readFile(file, 'utf8');
    let result: RewriteResult;
    try {
      result = rewriteImports(source, file, config);
    } catch (err) {
      errors.push({
        file,
        request: '',
        message: `parse error: ${(err as Error).message}`
      });
      return;
    }
    if (result.edits.length === 0) return;

    for (const edit of result.edits) {
      const origRequest = edit.originalText.slice(1, -1);
      const targetRel = resolveToRelative(origRequest, file, config);
      if (!targetRel) continue;
      const targetAbs = path.resolve(path.dirname(file), targetRel);
      if (!(await existsAnyExtension(targetAbs, config.extensions))) {
        errors.push({
          file,
          request: origRequest,
          message: `dangling alias: target not found at ${targetAbs}`
        });
      }
    }

    if (options.dryRun) {
      filesRewritten++;
      editCount += result.edits.length;
      return;
    }

    await fs.writeFile(file, result.output, 'utf8');

    const mapPath = file + '.map';
    if (config.sourceMap && fssync.existsSync(mapPath)) {
      try {
        const raw = JSON.parse(
          await fs.readFile(mapPath, 'utf8')
        ) as RawSourceMap;
        const adjusted = await adjustSourceMap(raw, result.edits);
        await fs.writeFile(mapPath, JSON.stringify(adjusted), 'utf8');
      } catch (err) {
        errors.push({
          file: mapPath,
          request: '',
          message: `sourcemap adjust failed: ${(err as Error).message}`
        });
      }
    }

    filesRewritten++;
    editCount += result.edits.length;
  }

  return {
    filesScanned: files.length,
    filesRewritten,
    editCount,
    errors,
    durationMs: Date.now() - start
  };
}

async function existsAnyExtension(
  basePath: string,
  exts: readonly string[]
): Promise<boolean> {
  try {
    const stat = await fs.stat(basePath);
    if (stat.isFile()) return true;
    if (stat.isDirectory()) {
      for (const ext of exts) {
        if (fssync.existsSync(path.join(basePath, 'index' + ext))) return true;
      }
    }
  } catch {
    // fall through
  }
  for (const ext of exts) {
    if (fssync.existsSync(basePath + ext)) return true;
  }
  return false;
}
