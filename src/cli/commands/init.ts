import * as fs from 'node:fs';
import * as path from 'node:path';

export interface InitArgs {
  projectRoot: string;
}

/**
 * Print a suggested snippet the user should add to their tsconfig.
 * Non-destructive: does not modify user files.
 */
export function runInit(args: InitArgs): number {
  const tsconfigPath = path.join(args.projectRoot, 'tsconfig.json');
  const exists = fs.existsSync(tsconfigPath);
  // eslint-disable-next-line no-console
  console.log('# path-alias init\n');
  // eslint-disable-next-line no-console
  console.log(
    `Target tsconfig: ${tsconfigPath}${exists ? '' : '  (does not exist)'}\n`
  );
  // eslint-disable-next-line no-console
  console.log('Add the following to compilerOptions:\n');
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        baseUrl: './src',
        paths: { '@/*': ['*'] }
      },
      null,
      2
    )
  );
  // eslint-disable-next-line no-console
  console.log('\nThen add to your build script:');
  // eslint-disable-next-line no-console
  console.log('  "build": "... && mwtsc && path-alias build"');
  // eslint-disable-next-line no-console
  console.log('\nAnd register at process start:');
  // eslint-disable-next-line no-console
  console.log(`  require('path-alias-plugin/register');`);
  return 0;
}
