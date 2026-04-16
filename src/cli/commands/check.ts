import { loadConfig } from '../../core/config';
import { transform } from '../../transformer';

export interface CheckArgs {
  tsconfig?: string;
  projectRoot: string;
}

export async function runCheck(args: CheckArgs): Promise<number> {
  const config = loadConfig({
    tsconfig: args.tsconfig,
    projectRoot: args.projectRoot
  });
  const summary = await transform(config, { dryRun: true });
  // eslint-disable-next-line no-console
  console.log(
    `[path-alias] check: ${summary.filesRewritten} file(s) would be rewritten, ${summary.editCount} alias import(s), ${summary.errors.length} error(s).`
  );
  if (summary.errors.length > 0) {
    for (const e of summary.errors) {
      // eslint-disable-next-line no-console
      console.error(`[path-alias] ${e.file}: ${e.message}`);
    }
    return 1;
  }
  return 0;
}
