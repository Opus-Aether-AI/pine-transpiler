/**
 * Validate Command
 *
 * Handles the 'validate' CLI command for checking Pine Script syntax.
 */

import type { CLIOptions } from '../types';
import { readInput } from '../utils';
import { canTranspilePineScript } from '../../index.js';

/**
 * Execute the validate command
 */
export function commandValidate(
  file: string | undefined,
  _options: CLIOptions,
): void {
  if (!file) {
    console.error('Error: No input file specified');
    console.error('Usage: pine-transpiler validate <file>');
    process.exit(1);
  }

  const code = readInput(file);
  const result = canTranspilePineScript(code);

  if (result.valid) {
    console.log(`✓ ${file} is valid Pine Script`);
    process.exit(0);
  } else {
    console.error(`✗ ${file} has syntax errors:`);
    console.error(`  ${result.reason}`);
    process.exit(1);
  }
}
