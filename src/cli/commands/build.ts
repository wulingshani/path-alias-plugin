import { loadConfig } from '../../core/config';
import { transform } from '../../transformer';

export interface BuildArgs {
  tsconfig?: string;
  dryRun: boolean;
  projectRoot: string;
  silent: boolean;
}

export async function runBuild(args: BuildArgs): Promise<number> {
  const config = loadConfig({
    tsconfig: args.tsconfig,
    projectRoot: args.projectRoot
  });
  const summary = await transform(config, { dryRun: args.dryRun });
  if (!args.silent) {
    // eslint-disable-next-line no-console
    console.log(
      `[path-alias] scanned ${summary.filesScanned} file(s), rewrote ${summary.filesRewritten}, ${summary.editCount} edit(s), ${summary.durationMs}ms` +
        (args.dryRun ? ' (dry-run, no files written)' : '')
    );
  }
  if (summary.errors.length > 0) {
    for (const e of summary.errors) {
      // eslint-disable-next-line no-console
      console.error(`[path-alias] ERROR ${e.file}: ${e.message}`);
    }
    return 1;
  }
  return 0;
}
