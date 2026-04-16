import { runBuild } from './commands/build';
import { runCheck } from './commands/check';
import { runInit } from './commands/init';

function parseArgs(argv: string[]): {
  command: string;
  flags: Record<string, string | boolean>;
} {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (const token of rest) {
    if (token.startsWith('--')) {
      const [k, v] = token.slice(2).split('=');
      flags[k] = v ?? true;
    }
  }
  return { command: command ?? '', flags };
}

export async function main(argv: string[]): Promise<number> {
  const { command, flags } = parseArgs(argv);
  const projectRoot = process.cwd();
  switch (command) {
    case 'build':
      return runBuild({
        tsconfig:
          typeof flags.tsconfig === 'string' ? flags.tsconfig : undefined,
        dryRun: flags['dry-run'] === true,
        silent: flags.silent === true,
        projectRoot
      });
    case 'check':
      return runCheck({
        tsconfig:
          typeof flags.tsconfig === 'string' ? flags.tsconfig : undefined,
        projectRoot
      });
    case 'init':
      return runInit({ projectRoot });
    case '':
    case '--help':
    case '-h':
      printHelp();
      return 0;
    default:
      // eslint-disable-next-line no-console
      console.error(`[path-alias] unknown command: ${command}`);
      printHelp();
      return 1;
  }
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: path-alias <command> [flags]

Commands:
  build              Rewrite alias imports in outDir.
    --dry-run        Don't write files, just report.
    --tsconfig=PATH  Use a specific tsconfig.
    --silent         Suppress info log.

  check              Validate all alias imports resolve. Exit 1 on errors.
    --tsconfig=PATH

  init               Print suggested tsconfig + package.json edits.
`);
}
