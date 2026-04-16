import { loadConfig } from '../core/config';
import { installHook } from './hook';

/**
 * Auto-register the path-alias require hook.
 *
 * Reads tsconfig.json + optional path-alias.config.json from process.cwd().
 * If loading fails, emits a warning but does not throw — host app startup
 * should not be blocked by a misconfigured alias plugin.
 */
export function register(): void {
  try {
    const config = loadConfig();
    installHook(config);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[path-alias] register failed, continuing without alias hook: ${(err as Error).message}`
    );
  }
}

register();
